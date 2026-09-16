/**
 * **세로만** 바꿨다가 되돌리면 구도가 제자리로 오는가.
 *
 * 🔴 이 검사가 없어서 못 잡은 것 (2026-09-16):
 *
 *    투영 보정(`setViewOffset`)을 거는 effect 의 cleanup 이 **재실행마다**
 *    보정을 지우는데, 재적용은 "처음 마운트일 때만" 이었다. 보정량은 **폭에만**
 *    의존하므로 높이만 바뀌면 값이 그대로고, `useFrame` 의 재적용 조건
 *    (`|현재 - 목표| > 0.3`)이 영영 거짓이 되어 **보정이 다시 안 걸린다.**
 *
 *    실측: 폭 1440 고정, 높이 900→820 에서 마커 7개가 한꺼번에 ~260px
 *    왼쪽으로 밀렸고 **820→900 으로 되돌려도 안 돌아왔다.**
 *
 *    ⚠️ 창을 직접 줄이는 것만 트리거가 아니다 — 개발자도구 여닫기,
 *       모바일 주소창 접힘, 홈→하위 전환에서 푸터가 사라지며 캔버스 높이가
 *       733→803→900 으로 바뀌는 것만으로도 걸린다.
 */
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
/** 되돌린 뒤 이만큼 넘게 어긋나면 실패. 감쇠 보간이 있어 몇 px 은 허용한다. */
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

  // 🔴 폭은 그대로 두고 높이만 바꾼다 — 보정량이 안 바뀌는 경로가 문제였다.
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
