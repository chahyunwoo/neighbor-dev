// 물건 7개를 하나씩 열어 촬영한다. 판정은 사람이 스크린샷으로 한다(마커 수는 클램프로 늘 7/7, WebGL 캔버스는 2D 로 못 읽는다).
// headed 로 돈다 — headless 는 3D 가 안 그려진다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
const OUT = process.argv[2] || '.'
const NAMES = ['모니터', '화이트보드', '책장', '서랍', '노트북', '테이블', '현관문']
;(async () => {
  const b = await chromium.launch(LAUNCH)
  for (const nm of NAMES) {
    const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await pg.waitForTimeout(4500)
    await pg
      .locator('button[class*="marker"]')
      .and(pg.getByLabel(new RegExp(`^${nm} —`)))
      .click({ force: true })
    await pg.waitForTimeout(1800)
    await pg.screenshot({ path: `${OUT}/${nm}.png` })
    console.log(`  saved ${nm}`)
    await pg.close()
  }
  await b.close()
  console.log(`\n${OUT} 의 7장을 열어서 눈으로 확인할 것 — 방이 보이는지, 대상이 화면에 있는지.`)
})()
