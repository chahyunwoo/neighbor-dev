/**
 * 입장 연출과 초점 비행 사이의 **상태 전이** 세 가지.
 *
 * 🔴 셋 다 기존 프로브가 못 잡았다 — 전부 "홈에 들어가 가만히 둔다" 만
 *    보기 때문이다. 사람은 연출이 끝나기를 기다려 주지 않는다.
 */
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

let fail = 0
const ok = (c, label, detail) => {
  if (!c) fail++
  console.log(`  ${c ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`)
}

/**
 * 두 스크린샷의 **픽셀 차이**를 잰다.
 *
 * 🔴 평균 휘도로는 못 잡는다 — 구도가 완전히 달라도 평균이 우연히 비슷하다
 *    (실측: 잘못된 구도 21.8 vs 제 구도 19.4, 배율 1.12). 실제로 그 판정으로
 *    무력화 검증이 **안 잡혔다.** 같은 자리의 픽셀을 직접 비교한다.
 */
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
    const r = document.querySelector('.canvas-shell').getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  const shot = (await pg.screenshot({ clip: box })).toString('base64')
  await pg.evaluate(() => document.getElementById('__probe_only_canvas')?.remove())
  return shot
}

;(async () => {
  const b = await chromium.launch(LAUNCH)

  /*
   * ── ① 입장 연출 도중 나가도 그 화면의 구도가 **곧바로** 잡히는가.
   *
   *    전에는 `skipIntro` 분기가 `started` 가드 **뒤**에 있어서 못 들어갔고,
   *    입장 비행이 4.2초를 끝까지 다 돈 뒤에야 초점 비행이 열렸다.
   *    실측: 이탈 600ms → 목표 구도가 4847ms 에야 잡혔다(그 사이 4101ms).
   */
  /*
   * 🔴 **판정은 "도착 뒤에도 화면이 한 번 더 도는가" 다.**
   *    잘못된 구도로 있다가 4.4~4.9초에 **한 번에 휙 도는** 것이 증상이므로,
   *    도착 직후(+1.6s)와 입장이 끝났을 시각(+5.5s)의 화면을 **픽셀로 비교**한다.
   *    제대로 고쳐졌으면 둘이 같다.
   */
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

  /*
   * ── ② 마커를 열 때 한 프레임에 크게 튀지 않는가.
   *
   *    `CAMERA_LIMITS_FOCUS.maxDistance`(6.5)를 비행 **시작**에 걸면,
   *    개요 거리 9.36 이 한 프레임에 30.6% 당겨진다(실측 202px).
   *    🔴 캔버스가 좁아져서가 아니다 — 캔버스 폭이 아직 1440 인 프레임에 난다.
   */
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
          // ⚠️ 라벨로 키를 잡고 **중심**을 잰다. DOM 순서·좌측 좌표로 재면
          //    열린 마커가 이름표를 펼쳐 상자가 커진 것이 이동으로 잡힌다.
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

  /*
   * ── ③ 입장 비행이 도는 동안 `data-room-entered` 가 꺼져 있는가.
   *
   *    `markEntered` 에 짝이 없어 한 번 켜지면 안 꺼졌다. `verify-clamp`·
   *    `canvas-probe` 가 이 값을 "이제 눌러도 된다" 게이트로 쓰는데,
   *    깊은 링크 경로에서는 **비행 중인데 true** 였다.
   */
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

  /*
   * ── ④ 마커를 **열었다 닫으면** 개요 구도가 제자리로 오는가.
   *
   *    제약을 비행 **끝**에만 걸었더니, **나오는 비행**(초점 → 개요 9.36)이
   *    비행 내내 옛 FOCUS 상한(6.5)에 잘렸다. 끝나서 상한을 12 로 돌려놔도
   *    **카메라를 도로 밀어내 주는 것이 없다** — 영영 30.6% 당겨진 채 남는다.
   *    실측: 마커 화면좌표 최대 편차 205px, scale 0.703 → 0.959.
   *
   * 🔴 **`verify-clamp` 는 마커를 열기만 하고 닫지 않아서** 이것을 못 봤다.
   *    여는 방향은 전부 FOCUS 제약 안이라 증상이 안 난다.
   */
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
    /*
     * 🔴 **양성 대조** — "마커가 실제로 열렸다" 를 단언한다. 없으면 클릭이
     *    아무것도 안 해도 픽셀차 0.03 으로 **초록이 뜬다**(실측 2026-09-17).
     *    검사기가 "안 잡혔다" 와 "아무 일도 안 일어났다" 를 못 가르면
     *    그 게이트는 있으나 마나다.
     */
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

  /*
   * ── ⑤ 깊은 링크로 들어와 홈에 올 때 **어둠막이 옅어졌다 돌아오지** 않는가.
   *
   *    `entered` 를 되돌리게 만들면서(프로브 게이트 용도) `.scrim` 의
   *    `data-lit` 이 날것 `lit` 을 보고 있어 한 번 꺼졌다 켜졌다.
   *    실측: 최소 불투명도 0.58~0.61 @324ms, `data-lit=false` 프레임 15개.
   *    글은 그대로 있는데 그 뒤 어둠막만 빠져 대비가 약해진다.
   */
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
    /*
     * 🔴 **양성 대조** — 프레임을 하나도 못 읽었으면 실패다. 없으면 선택자가
     *    안 맞아 `.scrim` 을 못 찾아도 **초록이 뜬다**(실측: `: 1` 폴백이라
     *    0개면 그냥 통과했다). CSS Module 해시가 바뀌면 조용히 눈이 먼다.
     */
    ok(v.length >= 30, '   (대조) 어둠막을 실제로 읽었다', `프레임 ${v.length}개`)
    const min = v.length ? Math.min(...v) : 0
    ok(
      min >= 0.95,
      '깊은 링크 → 홈 에서 어둠막이 안 옅어진다',
      `최소 불투명도 ${min.toFixed(2)} (프레임 ${v.length}개)`,
    )
  }

  /*
   * ── ⑥ 마커를 **연 채로** 방을 둘러볼 때 초점 제약이 실제로 쓰이는가.
   *
   *    `abort` 리스너가 `'start'`(= 모든 pointerdown)에 붙어 있어서, 되돌릴
   *    비행이 없는데도 제약을 갈아치웠다. **마커를 연 채 드래그하는 첫
   *    순간에 FOCUS(방위각 0.44~1.08π)가 ROOM(0.54~0.98π)으로 바뀌어**
   *    마커를 닫을 때까지 그대로였다 — 실측 2026-09-17: 방위각 79.2° →
   *    115.2°(36°·31% 손실). 깨지는 화면은 아니고 **의도한 자유도가
   *    사라진 것**이라, 픽셀 비교로는 안 잡힌다.
   *
   * 🔴 판정은 **끝까지 돌렸을 때 닿는 각도**로 한다. 3D 마커의 화면 좌표가
   *    카메라 방위각을 그대로 반영하므로, 좌우로 끝까지 끈 뒤의 **가로 이동
   *    폭**을 본다. ROOM 제약이면 눈에 띄게 좁다.
   */
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

    /** 닫히지 않은 마커들의 가로 중심 평균. 방위각이 바뀌면 같이 움직인다. */
    /**
     * 닫히지 않은 마커들의 중심 평균. 방위각·극각이 바뀌면 같이 움직인다.
     *
     * ⚠️ **가로만 보면 극각을 못 잡는다.** 초점 제약이 잃는 것에는
     *    방위각 36° 말고 **극각 16.2°** 도 있는데(FOCUS 0.14~0.52π vs
     *    ROOM 0.17~0.46π), 가로 중심만 재면 그쪽만 되돌려 놔도 초록이 뜬다.
     */
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
    // 세로도 끝까지 — 극각 범위를 본다.
    await drag(0, -700)
    const up = await center()
    await drag(0, 1400)
    const down = await center()
    await ctx.close()
    const span = left && right ? Math.round(Math.abs(right.x - left.x)) : 0
    const vspan = up && down ? Math.round(Math.abs(down.y - up.y)) : 0
    /*
     * 실측 2026-09-17 (1440x900, 첫 마커를 연 채 좌우 끝까지):
     *   FOCUS 제약 913px   vs   ROOM 제약 409px
     * 두 배 넘게 갈리므로 기준은 그 사이에 넉넉히 둔다.
     */
    ok(
      span >= 700,
      '마커를 연 채 좌우로 둘러볼 때 초점 제약이 쓰인다',
      `이동 폭 ${span}px (기준 700px 이상 · 제약이 ROOM 이면 ~409px)`,
    )
    /*
     * 🔴 **이 값은 게이트다. 양성 대조가 아니다.**
     *    한때 `vspan >= 1` 이었는데, 그건 "세로 드래그가 뭔가 하긴 했다" 만
     *    확인할 뿐 **극각 제약이 죽어도 통과했다** — 실측 2026-09-17:
     *    `CAMERA_LIMITS_FOCUS` 의 극각만 ROOM 으로 되돌려(16.2° 손실)
     *    `vspan 74 → 53` 인데 `>= 1` 이라 초록이었다.
     *    바로 위 주석이 "가로만 보면 극각을 못 잡는다" 고 적어 놓고
     *    정작 판정은 가로 하나뿐이었던 셈이다.
     *
     *    값은 완전히 결정적이다(4회 반복 전부 913 / 74). 기준을 그 사이에 둔다.
     */
    ok(
      vspan >= 65,
      '마커를 연 채 위아래로 둘러볼 때 초점 극각이 쓰인다',
      `세로 이동 폭 ${vspan}px (기준 65px 이상 · 극각이 ROOM 이면 ~53px)`,
    )
  }

  /*
   * ── ⑦ **비행 도중** 드래그해서 중단시켜도 한 프레임에 튀지 않는가.
   *
   *    중단 지점에는 **목적지 제약도 출발 제약도 안전하지 않다** — 둘 다
   *    실제로 사고를 냈다:
   *      · 목적지(FOCUS 상한 6.5) → **들어가는** 비행을 개요 거리(9.36)에서
   *        중단하면 한 프레임에 30.6% 당겨진다(마커 111px)
   *      · 출발(ROOM 방위각) → FOCUS 범위까지 돌려 둔 채 **나오는** 비행을
   *        중단하면 한 프레임에 97° 꺾인다(마커 6756px)
   *    CLAUDE.md 가 "한 프레임에 79.3° 꺾였다 — 갑자기 화면이 휙 돈다" 로
   *    적어 둔 그 사고와 같은 형태다.
   *
   * 🔴 **기존 프로브는 비행이 끝난 뒤에만 드래그한다.** 그래서 이 경로를
   *    아무도 안 봤다 — 그런데 "손대면 비행을 포기한다" 는 설계상 의도된 조작이다.
   */
  /**
   * ⚠️ **절대값으로 판정하면 위양성이 난다.** 닫는 비행은 원래 크게 쓸어
   *    내려오므로(방위각을 끝까지 돌려 둔 상태면 더) 한 프레임 이동이
   *    **562px** 까지 나온다 — 드래그가 없어도 그렇다(실측 2026-09-17).
   *    그래서 같은 시나리오를 **드래그 있음/없음으로 두 번** 돌려 그 **차이**
   *    를 본다. 제약이 튀면 드래그 쪽만 커진다.
   */
  const run = async (phase, withDrag, pressAt) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'load' })
    await pg.waitForFunction(() => document.documentElement.dataset.roomEntered === 'true', null, {
      timeout: 25000,
    })
    await pg.waitForTimeout(1200)

    /**
     * **매 프레임 캔버스 픽셀 변화**의 최댓값을 기록한다.
     *
     * 🔴 마커 좌표로 재면 F2(방위각 97° 스냅)를 못 잡는다 — 닫는 비행은
     *    자체 쓸어내림이 커서 스냅이 그 안에 묻히고, 화면 밖으로 발산한
     *    마커를 빼면 신호가 사라진다. **그림 자체의 변화**가 더 곧다.
     *
     * 🔴 R3F 의 렌더 콜백보다 **뒤**에서 읽어야 한다 — 앞에서 읽으면
     *    drawingBuffer 가 비어 전부 0 이다(CLAUDE.md). 0 이 연속 읽히면
     *    `setTimeout` 을 한 번 거쳐 줄 맨 뒤로 다시 선다.
     */
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
      // 먼저 열고, FOCUS 범위 끝까지 돌려 둔 뒤 닫는다 — 방위각 판을 만든다.
      await pg.$eval('button[class*="marker"]', (e) => e.click())
      await pg.waitForTimeout(2600)
      await pg.mouse.move(480, 460)
      await pg.mouse.down()
      for (let i = 1; i <= 30; i++) await pg.mouse.move(480 - (900 * i) / 30, 460)
      await pg.mouse.up()
      await pg.waitForTimeout(600)
      await pg.keyboard.press('Escape')
    }
    // 비행이 도는 중(200ms)에 손을 댄다.
    const rec = watch()
    await pg.waitForTimeout(pressAt)
    let onCanvas = true
    if (withDrag) {
      /*
       * 🔴 **양성 대조 — 누른 지점이 캔버스여야 한다.**
       *    마커는 캔버스 위에 뜬 **DOM 버튼**이고 비행 중에 화면을 돌아다닌다.
       *    그 자리에 마커가 오면 pointerdown 을 버튼이 먹어 OrbitControls 의
       *    `'start'` 가 아예 안 뜬다 — 그러면 **"안 튀었다" 가 아니라
       *    "아무 일도 안 일어났다"** 인데 차이가 0 이라 초록이 뜬다
       *    (실측 2026-09-17: 패널 위를 눌렀더니 `start 0회 · 차이 0.0 · 통과`).
       */
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

  /*
   * ⚠️ **두 시점을 다 본다.** 초점 effect 의 deps 에 `size` 가 있어, 마커를
   *    열면 캔버스가 0.44초 걸쳐 좁아지며 effect 가 여러 번 다시 돌고
   *    **새 비행을 만든다** — 그래서 `abort` 로 죽인 비행이 되살아난다.
   *    200ms 는 그 "되살아나는" 구간이고, 700ms 는 중단이 유지되는 구간이다
   *    (실측 2026-09-17: 200ms 에 누르면 3초 뒤 거리가 목표 5.29 로 착지,
   *     700ms 면 6.5 에서 멈춘다). 한쪽만 재면 반쪽이다.
   */
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
