// 홈이 첫 페인트부터 한 화면에 담기는가 — 넘침이 220~680ms 에만 나타나므로 매 프레임 본다.
// headed 로 돈다 — headless 는 3D 가 안 그려져 조건이 달라진다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
const RUNS = Number(process.env.RUNS || 3)
;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  for (let run = 1; run <= RUNS; run++) {
    const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    await pg.addInitScript(() => {
      window.__o = []
      // scrollHeight 로 재지 않는다 — overflow-y: clip 이어도 값은 그대로다. 스크롤바가 보이면 clientWidth < innerWidth
      const t = () => {
        const d = document.documentElement
        if (window.innerWidth !== d.clientWidth)
          window.__o.push({ t: Math.round(performance.now()), w: d.clientWidth })
        requestAnimationFrame(t)
      }
      requestAnimationFrame(t)
    })
    await pg.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await pg.waitForTimeout(3000)
    const o = await pg.evaluate(() => window.__o || [])
    const ok = o.length === 0
    if (!ok) fail++
    console.log(
      ok
        ? `  ✓ 회차 ${run}  넘친 프레임 0`
        : `  ✗ 회차 ${run}  ${o.length}프레임 넘침  ${o[0].t}~${o.at(-1).t}ms  clientWidth ${o[0].w}px`,
    )
    await pg.close()
  }
  await b.close()
  console.log(fail ? `\n${RUNS}회 중 ${fail}회 실패` : `\n${RUNS}회 전부 통과`)
  process.exit(fail ? 1 : 0)
})()
