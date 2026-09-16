/**
 * 입장 연출과 초점 비행 사이의 **상태 전이** 세 가지.
 *
 * 🔴 셋 다 기존 프로브가 못 잡았다 — 전부 "홈에 들어가 가만히 둔다" 만
 *    보기 때문이다. 사람은 연출이 끝나기를 기다려 주지 않는다.
 */
const { chromium, LAUNCH } = require('./_pw.cjs')
const BASE = process.env.WEB_BASE_URL || 'http://localhost:3200'

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
    // 닫기 — 패널의 닫기 버튼, 없으면 Esc
    await pg.keyboard.press('Escape')
    await pg.waitForTimeout(2600)
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
    const min = v.length ? Math.min(...v) : 1
    ok(
      min >= 0.95,
      '깊은 링크 → 홈 에서 어둠막이 안 옅어진다',
      `최소 불투명도 ${min.toFixed(2)} (프레임 ${v.length}개)`,
    )
  }

  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n입장·초점 상태 전이가 전부 제때 일어난다')
  process.exit(fail ? 1 : 0)
})()
