/**
 * 이슈 #10 — 첫 화면에 읽을 것이 언제 뜨는가.
 *
 * 🔴 "마커가 다 떴는가" 로는 이 문제를 못 잡는다. 마커는 2.6초에 다 떠 있었는데
 *    **카피가 4.5초까지 안 보였다** — 방문자는 그동안 빈 방을 본다.
 *    보이는 것은 `opacity` 로 재야 한다(요소는 처음부터 DOM 에 있다).
 */
const { chromium } = require('./_pw.cjs')
/** 카피가 이 시각 안에는 읽혀야 한다(ms). */
const BUDGET = 1200
;(async () => {
  const b = await chromium.launch()
  let fail = 0
  for (const label of ['첫 진입', '복귀']) {
    const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    if (label === '복귀') {
      await pg.goto('http://localhost:3200/', { waitUntil: 'networkidle' })
      await pg.waitForTimeout(4000)
      await pg.goto('http://localhost:3200/work', { waitUntil: 'networkidle' })
      await pg.waitForTimeout(1200)
    }
    const t0 = Date.now()
    await pg.goto('http://localhost:3200/', { waitUntil: 'domcontentloaded' })
    let at = null
    for (let i = 0; i < 60; i++) {
      const r = await pg.evaluate(() => {
        const h = document.querySelector('h1')
        const c = document.querySelector('[class*="copyLayer"]')
        return {
          op: h?.parentElement ? Number(getComputedStyle(h.parentElement).opacity) : 0,
          // 🔴 하이드레이션 전에는 `data-lit` 이 아예 없고 opacity 는 1 이다.
          //    그 상태를 "보인다" 로 세면 **방어를 지워도 초록이 뜬다**
          //    (실측: 300ms 에 op=1.00 을 읽어 통과로 판정했는데, 실제로는
          //     5.6초까지 안 떴다). 클라이언트가 살아난 뒤부터 센다.
          hydrated: c?.dataset.lit !== undefined,
        }
      })
      if (r.hydrated && r.op > 0.6) {
        at = Date.now() - t0
        break
      }
      await pg.waitForTimeout(100)
    }
    const ok = at !== null && at <= BUDGET
    if (!ok) fail++
    console.log(
      `  ${ok ? '✓' : '✗'} ${label.padEnd(6)} 카피가 읽히는 시각 ${at ?? '미도달'}ms (예산 ${BUDGET}ms)`,
    )
    await pg.close()
  }
  await b.close()
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
