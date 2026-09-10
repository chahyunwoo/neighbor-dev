/**
 * 이슈 #24 — 홈이 첫 페인트부터 한 화면에 담기는가.
 *
 * 🔴 **매 프레임 본다.** 200ms 샘플링으로는 못 잡는다 — 넘침이 220~680ms
 *    구간에만 나타났다 사라진다.
 * 🔴 headed 로 돈다(headless 는 3D 가 안 그려져 조건 자체가 달라진다).
 */
const { chromium } = require('./_pw.cjs')
const RUNS = Number(process.env.RUNS || 3)
;(async () => {
  const b = await chromium.launch({ headless: false })
  let fail = 0
  for (let run = 1; run <= RUNS; run++) {
    const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    await pg.addInitScript(() => {
      window.__o = []
      /*
       * 🔴 `scrollHeight > innerHeight` 로 재지 않는다. `overflow-y: clip` 은
       *    스크롤을 막지만 **`scrollHeight` 값은 그대로**라, 이미 막았는데도
       *    빨갛게 나온다(실측: 28프레임 중 23프레임이 그 경우였다).
       *    **스크롤바가 실제로 보이는가**로 판정한다 — 세로 스크롤바가 생기면
       *    `documentElement.clientWidth` 가 `innerWidth` 보다 작아진다.
       */
      const t = () => {
        const d = document.documentElement
        if (window.innerWidth !== d.clientWidth)
          window.__o.push({ t: Math.round(performance.now()), w: d.clientWidth })
        requestAnimationFrame(t)
      }
      requestAnimationFrame(t)
    })
    await pg.goto('http://localhost:3200/', { waitUntil: 'domcontentloaded' })
    await pg.waitForTimeout(3000)
    const o = await pg.evaluate(() => window.__o || [])
    const ok = o.length === 0
    if (!ok) fail++
    console.log(
      ok
        ? `  ✓ 회차 ${run}  넘친 프레임 0`
        : `  ✗ 회차 ${run}  ${o.length}프레임 넘침  ${o[0].t}~${o.at(-1).t}ms  clientWidth ${o[0].w}px`,
    )
    await pg.close()
  }
  await b.close()
  console.log(fail ? `\n${RUNS}회 중 ${fail}회 실패` : `\n${RUNS}회 전부 통과`)
  process.exit(fail ? 1 : 0)
})()
