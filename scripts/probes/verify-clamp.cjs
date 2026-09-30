// 한 페이지 안에서 연속으로 마커를 눌러도 전부 열리는가 — 마커마다 새 컨텍스트로 재면 이 버그를 못 본다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
let fail = 0
const ok = (c, l, d) => {
  if (!c) fail++
  console.log(`  ${c ? '✓' : '✗'} ${l}${d ? `  — ${d}` : ''}`)
}
;(async () => {
  // headed 로 연다 — headless 는 12fps 로 떨어져 useEdgeClamp 의 매 프레임 재계산이 밀리고 클릭이 빗나간다
  const b = await chromium.launch(LAUNCH)
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    const pg = await (await b.newContext({ viewport: vp })).newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    // 시간이 아니라 상태로 기다린다 — 로딩이 느리면 첫 클릭이 입장 비행 중에 일어난다. RoomStage 가 입장 뒤 data-room-entered 를 남긴다
    await pg
      .waitForFunction(() => document.documentElement.dataset.roomEntered === 'true', {
        timeout: 15000,
      })
      .catch(() => {})
    await pg.waitForTimeout(600)
    // nth(i) 로 집지 않는다 — 클램프가 DOM 순서를 바꾼다. aria-label 로 고정한다
    // 마커 7개가 다 뜰 때까지 기다린다 — 안 기다리면 일부만 세고 통과한다
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
    // 같은 페이지에서 연속으로 — 카메라가 움직인 뒤에도 눌려야 한다
    for (const lab of labels) {
      // 같은 aria-label 이 왼쪽 번호 목록에도 있다 — 마커로 한정하지 않으면 strict mode 위반
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
    const out = await pg.evaluate(() => {
      // 3D 가 보이는 영역은 캔버스(뷰포트 전체)가 아니라 .canvas-frame 이다
      const c = document.querySelector('.canvas-frame').getBoundingClientRect()
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
