/**
 * 이슈 #14 — 마커가 3D 와 같은 리듬으로 움직이는가.
 *
 * 🔴 **headed 로 돌린다.** headless 는 GPU 가 없어 12fps 로 떨어지고,
 *    그 상태로 재면 "마커가 3.5초에 걸쳐 하나씩 뜬다" 같은 **가짜 증상**이
 *    나온다(실측: 실제 브라우저에서는 67ms 안에 7개가 다 뜬다).
 *
 * 🔴 정지 스크린샷·200ms 샘플링으로는 못 잡는다. 매 프레임(rAF) 기록한다.
 */
const { chromium } = require('./_pw.cjs')
/** 카메라가 나는 동안 마커가 갱신돼야 하는 최소 프레임 비율. */
const MIN_RATIO = 0.5

;(async () => {
  const b = await chromium.launch({ headless: false })
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  let fail = 0

  await pg.goto('http://localhost:3200/', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(5000)

  await pg.evaluate(() => {
    window.__d = []
    const t = () => {
      const w = document.querySelector('.room-marker-wrap')
      const btn = w?.querySelector('button')
      if (w && btn) window.__d.push(btn.getBoundingClientRect().x)
      requestAnimationFrame(t)
    }
    requestAnimationFrame(t)
  })
  await pg
    .locator('button[class*="marker"]')
    .and(pg.getByLabel(/^모니터 —/))
    .click({ force: true })
  await pg.waitForTimeout(2200)

  const d = await pg.evaluate(() => window.__d)
  let changed = 0
  for (let i = 1; i < d.length; i++) if (d[i] !== d[i - 1]) changed++
  const ratio = changed / d.length
  const ok = ratio >= MIN_RATIO
  if (!ok) fail++
  console.log(
    `  ${ok ? '✓' : '✗'} 마커 갱신 ${changed}/${d.length}프레임 (${(ratio * 100).toFixed(0)}%, 최소 ${MIN_RATIO * 100}%)`,
  )

  await b.close()
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
