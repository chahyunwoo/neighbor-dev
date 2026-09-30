// 첫 화면에 카피가 언제 읽히는가 — 마커가 다 떴는지로는 못 잡는다. 요소는 처음부터 DOM 에 있으니 opacity 로 잰다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
// 카피가 읽혀야 하는 시각(ms)
const BUDGET = 1200
;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  for (const label of ['첫 진입', '복귀']) {
    const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    if (label === '복귀') {
      await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await pg.waitForTimeout(4000)
      await pg.goto(`${BASE}/work`, { waitUntil: 'networkidle' })
      await pg.waitForTimeout(1200)
    }
    const t0 = Date.now()
    await pg.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    let at = null
    for (let i = 0; i < 60; i++) {
      const r = await pg.evaluate(() => {
        const h = document.querySelector('h1')
        const c = document.querySelector('[class*="copyLayer"]')
        return {
          op: h?.parentElement ? Number(getComputedStyle(h.parentElement).opacity) : 0,
          // 하이드레이션 전에는 data-lit 이 없고 opacity 가 1 이라 세면 방어를 지워도 초록 — 클라이언트가 살아난 뒤부터 센다
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
