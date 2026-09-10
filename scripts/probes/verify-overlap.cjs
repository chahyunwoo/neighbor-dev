/**
 * 이슈 #6 — 마커가 서로 덮지 않는가.
 *
 * 🔴 **여러 번 돌린다.** 이 버그는 간헐적이라 1회로는 못 잡는다 —
 *    실측 2026-09-09: 방어를 제거한 상태에서도 3회 중 1회만 실패가 났다.
 *    한 번 초록을 근거로 "고쳤다" 고 하면 안 된다.
 *
 * 🔴 `verify-clamp.cjs` 로는 이 버그가 **안 잡힌다**(방어를 지워도 7/7 이 나왔다).
 *    그쪽은 "캔버스 밖으로 나갔는가" 를 보고, 이쪽은 "서로 덮는가" 를 본다.
 */
const { chromium } = require('./_pw.cjs')
const RUNS = Number(process.env.RUNS || 5)
const VP = { width: 1440, height: 900 }

;(async () => {
  const b = await chromium.launch()
  let fail = 0
  for (let run = 1; run <= RUNS; run++) {
    const pg = await (await b.newContext({ viewport: VP })).newPage()
    await pg.goto('http://localhost:3200/', { waitUntil: 'networkidle' })
    await pg.waitForFunction(
      () => document.querySelectorAll('button[class*="marker"]').length >= 7,
      null,
      { timeout: 15000 },
    )
    await pg.waitForTimeout(5000)

    const labels = await pg
      .locator('button[class*="marker"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    let opened = 0
    const bad = []
    for (const lab of labels) {
      const nm = lab.split(' —')[0]
      const btn = pg.locator('button[class*="marker"]').and(pg.getByLabel(lab, { exact: true }))
      try {
        await btn.click({ timeout: 4000, force: true })
      } catch {}
      await pg.waitForTimeout(1500)
      if ((await btn.getAttribute('aria-expanded')) === 'true') opened++
      else bad.push(nm)
    }
    // 마커가 서로를 덮고 있는가 — 중심점의 최상단이 자기 것인지 본다
    const covered = await pg.evaluate(() => {
      const out = []
      document.querySelectorAll('button[class*="marker"]').forEach((el) => {
        const r = el.getBoundingClientRect()
        const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        if (t && t.closest('button[class*="marker"]') !== el)
          out.push(el.getAttribute('aria-label').split(' —')[0])
      })
      return out
    })
    const ok = opened === 7 && covered.length === 0
    if (!ok) fail++
    console.log(
      `  ${ok ? '✓' : '✗'} 회차 ${run}  ${opened}/7 열림` +
        (bad.length ? `  안 열림: ${bad.join(',')}` : '') +
        (covered.length ? `  덮임: ${covered.join(',')}` : ''),
    )
    await pg.close()
  }
  await b.close()
  console.log(fail ? `\n${RUNS}회 중 ${fail}회 실패` : `\n${RUNS}회 전부 통과`)
  process.exit(fail ? 1 : 0)
})()
