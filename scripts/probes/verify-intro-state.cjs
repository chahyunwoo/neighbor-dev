// 입장 연출과 초점 비행 사이의 상태 전이 — 사람은 연출이 끝나기를 기다려 주지 않으므로 도중에 나가고 누르고 끈다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

let fail = 0
const ok = (c, label, detail) => {
  if (!c) fail++
  console.log(`  ${c ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`)
}

// 두 스크린샷의 픽셀 차이 — 평균 휘도는 구도가 달라도 우연히 비슷해 못 잡는다
const DIFF = ([a, b]) =>
  new Promise((res) => {
    const load = (s) =>
      new Promise((r) => {
        const i = new Image()
        i.onload = () => r(i)
        i.src = `data:image/png;base64,${s}`
      })
    Promise.all([load(a), load(b)]).then(([x, y]) => {
      const c = document.createElement('canvas')
      c.width = Math.min(x.width, y.width)
      c.height = Math.min(x.height, y.height)
      const g = c.getContext('2d')
      g.drawImage(x, 0, 0)
      const dx = g.getImageData(0, 0, c.width, c.height).data
      g.clearRect(0, 0, c.width, c.height)
      g.drawImage(y, 0, 0)
      const dy = g.getImageData(0, 0, c.width, c.height).data
      let sum = 0
      for (let i = 0; i < dx.length; i += 4) {
        sum +=
          Math.abs(dx[i] - dy[i]) +
          Math.abs(dx[i + 1] - dy[i + 1]) +
          Math.abs(dx[i + 2] - dy[i + 2])
      }
      res(+(sum / (dx.length / 4) / 3).toFixed(2))
    })
  })

async function shotNow(pg) {
  const box = await pg.evaluate(() => {
    let s = document.getElementById('__probe_only_canvas')
    if (!s) {
      s = document.createElement('style')
      s.id = '__probe_only_canvas'
      s.textContent =
        '.canvas-shell{opacity:1!important}body>*:not(.canvas-shell){visibility:hidden!important}'
      document.head.appendChild(s)
    }
    // 3D 가 보이는 영역은 캔버스(뷰포트 전체)가 아니라 .canvas-frame 이다
    const r = document.querySelector('.canvas-frame').getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  const shot = (await pg.screenshot({ clip: box })).toString('base64')
  await pg.evaluate(() => document.getElementById('__probe_only_canvas')?.remove())
  return shot
}

;(async () => {
  const b = await chromium.launch(LAUNCH)

  // ① 입장 연출 도중 나가도 그 화면의 구도가 곧바로 잡히는가
  // 도착 직후(+1.6s)와 입장이 끝났을 시각(+5.5s)을 픽셀로 비교한다 — 뒤늦게 한 번 휙 도는 것이 증상
  for (const leaveAt of [600, 1200, 2600]) {
    const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const p2 = await c2.newPage()
    await p2.goto(`${BASE}/`, { waitUntil: 'load' })
    await p2.waitForTimeout(leaveAt)
    await p2.$eval('a[href="/work"]', (e) => e.click())
    await p2.waitForURL('**/work')
    await p2.waitForTimeout(1600) // 초점 비행(900ms) + 여유
    const early = await shotNow(p2)
    await p2.waitForTimeout(3900) // 입장 4.2초가 끝나고도 남을 시각
    const late = await shotNow(p2)
    const d = await p2.evaluate(DIFF, [early, late])
    await c2.close()
    ok(
      d <= 3,
      `입장 ${leaveAt}ms 에 이탈해도 나중에 구도가 안 바뀐다`,
      `+1.6s vs +5.5s 픽셀차 ${d} (기준 3 이하)`,
    )
  }

  // ② 마커를 열 때 한 프레임에 크게 튀지 않는가 — 초점 거리 상한을 비행 시작에 걸면 한 프레임에 당겨진다
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'load' })
    await pg.waitForFunction(() => document.documentElement.dataset.roomEntered === 'true', null, {
      timeout: 20000,
    })
    await pg.waitForTimeout(800)
    const worst = await pg.evaluate(
      () =>
        new Promise((res) => {
          // 라벨로 키를 잡고 중심을 잰다 — 좌측 좌표면 열린 마커의 이름표 펼침이 이동으로 잡힌다
          const snap = () => {
            const m = {}
            for (const e of document.querySelectorAll('button[class*="marker"]')) {
              if (e.getAttribute('aria-expanded') === 'true') continue
              const r = e.getBoundingClientRect()
              m[e.getAttribute('aria-label')] = [r.x + r.width / 2, r.y + r.height / 2]
            }
            return m
          }
          let prev = snap()
          let max = 0
          const t0 = performance.now()
          const tick = () => {
            const cur = snap()
            for (const k of Object.keys(cur)) {
              if (!prev[k]) continue
              const d = Math.hypot(cur[k][0] - prev[k][0], cur[k][1] - prev[k][1])
              if (d > max) max = d
            }
            prev = cur
            if (performance.now() - t0 < 1400) requestAnimationFrame(tick)
            else res(Math.round(max))
          }
          const el = [...document.querySelectorAll('button[class*="marker"]')].find((e) =>
            (e.getAttribute('aria-label') ?? '').startsWith('화이트보드'),
          )
          requestAnimationFrame(tick)
          el.click()
        }),
    )
    await ctx.close()
    ok(worst <= 90, '마커를 열 때 한 프레임 최대 이동', `${worst}px (기준 90px 이하)`)
  }

  // ③ 입장 비행 중에는 data-room-entered 가 꺼져 있는가 — 프로브들이 "이제 눌러도 된다" 게이트로 쓴다
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}/work`, { waitUntil: 'load' })
    await pg.waitForTimeout(6000)
    await pg.$eval('a[href="/"]', (e) => e.click())
    await pg.waitForURL((u) => new URL(u).pathname === '/')
    await pg.waitForTimeout(400)
    const during = await pg.evaluate(() => document.documentElement.dataset.roomEntered)
    await pg.waitForTimeout(6000)
    const after = await pg.evaluate(() => document.documentElement.dataset.roomEntered)
    await ctx.close()
    ok(during !== 'true', '입장 비행 중에는 data-room-entered 가 꺼져 있다', `비행 중 ${during}`)
    ok(after === 'true', '입장이 끝나면 다시 켜진다', `끝난 뒤 ${after}`)
  }

  // ④ 마커를 열었다 닫으면 개요 구도가 제자리로 오는가 — 나오는 비행이 초점 상한에 잘리면 당겨진 채 남는다
  // verify-clamp 는 열기만 해서 이것을 못 본다
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'load' })
    await pg.waitForFunction(() => document.documentElement.dataset.roomEntered === 'true', null, {
      timeout: 25000,
    })
    await pg.waitForTimeout(1200)
    const before = await shotNow(pg)
    await pg.$eval('button[class*="marker"]', (e) => e.click())
    await pg.waitForTimeout(1800)
    // 양성 대조 — 마커가 실제로 열렸는지 단언한다. 없으면 클릭이 아무것도 안 해도 초록이 뜬다
    const cntOpen = () =>
      pg.evaluate(
        () => document.querySelectorAll('button[class*="marker"][aria-expanded="true"]').length,
      )
    const opened = await cntOpen()
    ok(opened === 1, '   (대조) 마커가 실제로 열렸다', `열린 마커 ${opened}개`)
    // 닫기 — 패널의 닫기 버튼, 없으면 Esc
    await pg.keyboard.press('Escape')
    await pg.waitForTimeout(2600)
    const stillOpen = await cntOpen()
    ok(stillOpen === 0, '   (대조) 마커가 실제로 닫혔다', `열린 마커 ${stillOpen}개`)
    const after = await shotNow(pg)
    const d = await pg.evaluate(DIFF, [before, after])
    await ctx.close()
    ok(
      d <= 4,
      '마커를 열었다 닫으면 개요 구도가 제자리로 온다',
      `열기 전 vs 닫은 뒤 픽셀차 ${d} (기준 4 이하)`,
    )
  }

  // ⑤ 깊은 링크로 들어와 홈에 올 때 어둠막이 옅어졌다 돌아오지 않는가
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await ctx.newPage()
    await pg.addInitScript(() => {
      window.__scrim = []
      const tick = () => {
        const s = document.querySelector('[class*="scrim"]')
        if (s) window.__scrim.push(Number.parseFloat(getComputedStyle(s).opacity))
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await pg.goto(`${BASE}/work`, { waitUntil: 'load' })
    await pg.waitForTimeout(5000)
    await pg.evaluate(() => {
      window.__scrim.length = 0
    })
    await pg.$eval('a[href="/"]', (e) => e.click())
    await pg.waitForURL((u) => new URL(u).pathname === '/')
    await pg.waitForTimeout(2500)
    const v = await pg.evaluate(() => window.__scrim)
    await ctx.close()
    // 양성 대조 — 프레임을 못 읽었으면 실패다. CSS Module 해시가 바뀌면 선택자가 조용히 눈이 먼다
    ok(v.length >= 30, '   (대조) 어둠막을 실제로 읽었다', `프레임 ${v.length}개`)
    const min = v.length ? Math.min(...v) : 0
    ok(
      min >= 0.95,
      '깊은 링크 → 홈 에서 어둠막이 안 옅어진다',
      `최소 불투명도 ${min.toFixed(2)} (프레임 ${v.length}개)`,
    )
  }

  // ⑥ 마커를 연 채로 둘러볼 때 초점 제약(FOCUS)이 실제로 쓰이는가 — 드래그 첫 순간 ROOM 으로 바뀌던 회귀. 픽셀 비교로는 안 잡힌다
  // 끝까지 돌렸을 때 닿는 범위로 판정한다 — 마커 화면 좌표가 카메라 각도를 그대로 반영한다
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'load' })
    await pg.waitForFunction(() => document.documentElement.dataset.roomEntered === 'true', null, {
      timeout: 25000,
    })
    await pg.waitForTimeout(1200)
    await pg.$eval('button[class*="marker"]', (e) => e.click())
    await pg.waitForTimeout(2600)
    const opened = await pg.evaluate(
      () => document.querySelectorAll('button[class*="marker"][aria-expanded="true"]').length,
    )
    ok(opened === 1, '   (대조) 둘러보기 전 마커가 열려 있다', `열린 마커 ${opened}개`)

    // 닫히지 않은 마커들의 중심 평균 — 가로만 보면 극각 제약 손실을 못 잡아 세로도 본다
    const center = () =>
      pg.evaluate(() => {
        const m = [...document.querySelectorAll('button[class*="marker"]')].filter(
          (e) => e.getAttribute('aria-expanded') !== 'true',
        )
        if (!m.length) return null
        let x = 0
        let y = 0
        for (const e of m) {
          const r = e.getBoundingClientRect()
          x += r.x + r.width / 2
          y += r.y + r.height / 2
        }
        return { x: x / m.length, y: y / m.length }
      })

    const drag = async (dx, dy = 0) => {
      await pg.mouse.move(480, 460)
      await pg.mouse.down()
      for (let i = 1; i <= 30; i++) await pg.mouse.move(480 + (dx * i) / 30, 460 + (dy * i) / 30)
      await pg.mouse.up()
      await pg.waitForTimeout(500)
    }
    await drag(-900)
    const left = await center()
    await drag(1800)
    const right = await center()
    // 세로도 끝까지 — 극각 범위를 본다
    await drag(0, -700)
    const up = await center()
    await drag(0, 1400)
    const down = await center()
    await ctx.close()
    const span = left && right ? Math.round(Math.abs(right.x - left.x)) : 0
    const vspan = up && down ? Math.round(Math.abs(down.y - up.y)) : 0
    // 1440x900 기준 FOCUS 913px vs ROOM 409px — 기준은 그 사이
    ok(
      span >= 700,
      '마커를 연 채 좌우로 둘러볼 때 초점 제약이 쓰인다',
      `이동 폭 ${span}px (기준 700px 이상 · 제약이 ROOM 이면 ~409px)`,
    )
    // 게이트다(양성 대조 아님) — >= 1 이면 극각 제약이 죽어도 통과한다. 값은 결정적(913 / 74)이라 기준을 그 사이에 둔다
    ok(
      vspan >= 65,
      '마커를 연 채 위아래로 둘러볼 때 초점 극각이 쓰인다',
      `세로 이동 폭 ${vspan}px (기준 65px 이상 · 극각이 ROOM 이면 ~53px)`,
    )
  }

  // ⑦ 비행 도중 드래그로 중단해도 한 프레임에 튀지 않는가 — 중단 지점에는 목적지·출발 제약 둘 다 안전하지 않다
  // 절대값으로 판정하면 위양성 — 닫는 비행은 원래 크게 쓸어내린다. 드래그 있음/없음 두 번 돌려 차이를 본다
  const run = async (phase, withDrag, pressAt) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'load' })
    await pg.waitForFunction(() => document.documentElement.dataset.roomEntered === 'true', null, {
      timeout: 25000,
    })
    await pg.waitForTimeout(1200)

    // 매 프레임 캔버스 픽셀 변화의 최댓값 — 마커 좌표는 닫는 비행의 쓸어내림에 스냅이 묻힌다
    // R3F 렌더 콜백보다 뒤에서 읽어야 한다(앞이면 drawingBuffer 가 비어 0). 0 이 이어지면 setTimeout 으로 줄 뒤에 다시 선다
    const watch = () =>
      pg.evaluate(
        () =>
          new Promise((res) => {
            const W = 64
            const H = 40
            const c = document.createElement('canvas')
            c.width = W
            c.height = H
            const g = c.getContext('2d', { willReadFrequently: true })
            let prev = null
            let max = 0
            let zeros = 0
            const t0 = performance.now()
            const tick = () => {
              const gl = document.querySelector('canvas')
              if (gl) {
                g.clearRect(0, 0, W, H)
                try {
                  g.drawImage(gl, 0, 0, W, H)
                } catch {}
                const d = g.getImageData(0, 0, W, H).data
                let sum = 0
                let diff = 0
                const cur = new Float32Array(W * H)
                for (let i = 0, k = 0; i < d.length; i += 4, k++) {
                  const v = d[i] + d[i + 1] + d[i + 2]
                  cur[k] = v
                  sum += v
                  if (prev) diff += Math.abs(v - prev[k])
                }
                if (sum === 0) {
                  zeros++
                  if (zeros > 3) {
                    zeros = 0
                    setTimeout(() => requestAnimationFrame(tick), 0)
                    return
                  }
                } else {
                  zeros = 0
                  if (prev) {
                    const m = diff / (W * H) / 3
                    if (m > max) max = m
                  }
                  prev = cur
                }
              }
              if (performance.now() - t0 < 1500) requestAnimationFrame(tick)
              else res(+max.toFixed(1))
            }
            requestAnimationFrame(tick)
          }),
      )

    if (phase === '여는 비행') {
      await pg.$eval('button[class*="marker"]', (e) => e.click())
    } else {
      // 먼저 열고 FOCUS 범위 끝까지 돌려 둔 뒤 닫는다
      await pg.$eval('button[class*="marker"]', (e) => e.click())
      await pg.waitForTimeout(2600)
      await pg.mouse.move(480, 460)
      await pg.mouse.down()
      for (let i = 1; i <= 30; i++) await pg.mouse.move(480 - (900 * i) / 30, 460)
      await pg.mouse.up()
      await pg.waitForTimeout(600)
      await pg.keyboard.press('Escape')
    }
    // 비행이 도는 중에 손을 댄다
    const rec = watch()
    await pg.waitForTimeout(pressAt)
    let onCanvas = true
    if (withDrag) {
      // 양성 대조 — 누른 지점이 캔버스여야 한다. 마커 버튼이 pointerdown 을 먹으면 아무 일도 안 일어나 차이 0 으로 통과한다
      onCanvas = await pg.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.tagName === 'CANVAS',
        [480, 460],
      )
      await pg.mouse.move(480, 460)
      await pg.mouse.down()
      await pg.waitForTimeout(120)
      await pg.mouse.up()
    }
    const worst = await rec
    await ctx.close()
    return { worst, onCanvas }
  }

  // 두 시점을 다 본다 — 200ms 는 캔버스 폭 변화로 중단한 비행이 되살아나는 구간, 700ms 는 중단이 유지되는 구간
  for (const phase of ['여는 비행', '닫는 비행']) {
    for (const pressAt of [200, 700]) {
      const a = await run(phase, false, pressAt)
      const b = await run(phase, true, pressAt)
      ok(
        b.onCanvas,
        `   (대조) ${phase} ${pressAt}ms — 누른 곳이 캔버스다`,
        b.onCanvas ? '캔버스' : '다른 요소가 먹었다',
      )
      const extra = b.worst - a.worst
      ok(
        extra <= 6,
        `${phase} ${pressAt}ms 에 드래그해도 한 프레임에 안 튄다`,
        `한 프레임 그림 변화 — 없음 ${a.worst} · 있음 ${b.worst} → 차이 ${extra.toFixed(1)} (기준 6 이하)`,
      )
    }
  }

  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n입장·초점 상태 전이가 전부 제때 일어난다')
  process.exit(fail ? 1 : 0)
})()
