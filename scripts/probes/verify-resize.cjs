// 세로만 바꿨다가 되돌리면 구도가 제자리로 오는가 — 투영 보정은 폭에만 의존해 높이만 바뀌면 재적용이 안 걸리던 회귀를 막는다.
// 개발자도구 여닫기·모바일 주소창·푸터 유무로 캔버스 높이만 바뀌는 경우도 같은 경로다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
// 되돌린 뒤 허용 어긋남(px) — 감쇠 보간이 있다
const TOL = 12

const XS = () =>
  [...document.querySelectorAll('button[class*="marker"]')]
    .map((e) => ({ k: e.getAttribute('aria-label'), x: Math.round(e.getBoundingClientRect().x) }))
    .sort((a, b) => (a.k < b.k ? -1 : 1))

;(async () => {
  const b = await chromium.launch(LAUNCH)
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const pg = await ctx.newPage()
  await pg.goto(`${BASE}/`, { waitUntil: 'load' })
  await pg.waitForFunction(
    () => document.querySelectorAll('button[class*="marker"]').length >= 7,
    null,
    { timeout: 20000 },
  )
  await pg.waitForTimeout(6000)
  const before = await pg.evaluate(XS)

  // 폭은 그대로, 높이만 바꾼다
  await pg.setViewportSize({ width: 1440, height: 820 })
  await pg.waitForTimeout(1500)
  const mid = await pg.evaluate(XS)
  await pg.setViewportSize({ width: 1440, height: 900 })
  await pg.waitForTimeout(1500)
  const after = await pg.evaluate(XS)
  await b.close()

  const diff = before.map((p, i) => Math.abs(p.x - (after[i]?.x ?? 1e9)))
  const worst = Math.max(...diff)
  const midShift = Math.max(...before.map((p, i) => Math.abs(p.x - (mid[i]?.x ?? 1e9))))
  console.log(`  마커 ${before.length}개 · 높이 바꾼 동안 최대 이동 ${midShift}px`)
  const ok = worst <= TOL
  console.log(`  ${ok ? '✓' : '✗'} 높이 900→820→900 복귀 후 최대 어긋남 ${worst}px (허용 ${TOL}px)`)
  if (!ok) {
    for (let i = 0; i < before.length; i++) {
      console.log(`     ${before[i].k}  ${before[i].x} → ${mid[i]?.x} → ${after[i]?.x}`)
    }
  }
  console.log(ok ? '\n세로만 바꿔도 구도가 제자리로 온다' : '\n실패 1건')
  process.exit(ok ? 0 : 1)
})()
