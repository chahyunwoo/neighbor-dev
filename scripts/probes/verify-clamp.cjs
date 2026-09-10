/**
 * 이슈 #3 — **한 페이지 안에서 연속으로** 마커를 눌러도 전부 열리는가.
 * 마커마다 새 컨텍스트로 재면 이 이슈를 못 본다(프롬프트가 경고한 함정).
 */
const { chromium } = require('./_pw.cjs')
let fail = 0
const ok = (c, l, d) => {
  if (!c) fail++
  console.log(`  ${c ? '✓' : '✗'} ${l}${d ? `  — ${d}` : ''}`)
}
;(async () => {
  const b = await chromium.launch()
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    const pg = await (await b.newContext({ viewport: vp })).newPage()
    await pg.goto('http://localhost:3200/', { waitUntil: 'networkidle' })
    await pg.waitForTimeout(5000)
    // ⚠️ `nth(i)` 로 집지 않는다 — 클램프가 DOM 순서를 바꿔 **매번 다른
    //    마커를 누르게 된다**(실측: 그 탓에 1920 이 2/7 로 나왔는데 실제로는
    //    7/7 이었다). aria-label 로 고정해 집는다.
    // 🔴 마커 7개가 다 뜰 때까지 기다린다. 안 기다리면 **일부만 세고
    //    "4/4 통과" 처럼 초록이 뜬다** — 실측 2026-09-09, 1280 에서 그랬다.
    await pg.waitForFunction(
      () => document.querySelectorAll('button[class*="marker"]').length >= 7,
      null,
      { timeout: 15000 },
    )
    const labels = await pg
      .locator('button[class*="marker"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    const n = labels.length
    let opened = 0
    // 🔴 같은 페이지에서 연속으로 누른다 — 카메라가 움직인 뒤에도 눌려야 한다.
    for (const lab of labels) {
      // ⚠️ 같은 aria-label 이 **왼쪽 번호 목록에도** 있다(폴백 경로라 의도된
      //    중복이다). 마커로 한정하지 않으면 strict mode 위반이 난다.
      const btn = pg.locator('button[class*="marker"]').and(pg.getByLabel(lab, { exact: true }))
      try {
        await btn.click({ timeout: 4000, force: true })
        await pg.waitForTimeout(1500)
        if ((await btn.getAttribute('aria-expanded')) === 'true') opened++
      } catch (e) {
        console.log('     · 실패:', lab, String(e.message).split('\n')[0].slice(0, 60))
      }
    }
    ok(
      opened === 7 && n === 7,
      `${vp.width}x${vp.height} 연속 클릭`,
      `${opened}/${n} 열림 (기대 7/7)`,
    )
    // 캔버스 밖으로 나간 마커가 없는지
    const out = await pg.evaluate(() => {
      const c = document.querySelector('canvas').getBoundingClientRect()
      let n = 0
      document.querySelectorAll('button[class*="marker"]').forEach((el) => {
        const r = el.getBoundingClientRect()
        const x = r.x + r.width / 2,
          y = r.y + r.height / 2
        if (x < c.left || x > c.right || y < c.top || y > c.bottom) n++
      })
      return n
    })
    ok(out === 0, `${vp.width}x${vp.height} 캔버스 밖 마커 없음`, `${out}개`)
  }
  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
