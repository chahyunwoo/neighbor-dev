/**
 * 물건 7개를 하나씩 열어 촬영한다 (이슈 #17).
 *
 * 🔴 **판정은 사람이 스크린샷을 보고 한다.** 자동 지표가 없다 —
 *    "화면 안 마커 수" 는 클램프 때문에 항상 7/7 이고, 캔버스 밝기는
 *    WebGL 이라 2D 컨텍스트로 못 읽는다(전부 0). 둘 다 시도해서 확인했다.
 * 🔴 headed 로 돈다(headless 는 3D 가 안 그려진다).
 */
const { chromium } = require('./_pw.cjs')
const OUT = process.argv[2] || '.'
const NAMES = ['모니터', '화이트보드', '책장', '서랍', '노트북', '테이블', '현관문']
;(async () => {
  const b = await chromium.launch({ headless: false })
  for (const nm of NAMES) {
    const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    await pg.goto('http://localhost:3200/', { waitUntil: 'networkidle' })
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
