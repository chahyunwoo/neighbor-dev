/**
 * 이슈 #15 — 복귀 시 입장 연출을 다시 보여주지 않는가.
 *
 * 🔴 **headed 로 돌린다.** headless 는 GPU 가 없어 프레임이 안 나오고,
 *    그러면 카메라 비행 자체를 못 본다(이 저장소가 그 오진을 두 번 밟았다).
 */
const { chromium } = require('./_pw.cjs')
/** 복귀 비행은 이 안에 끝나야 한다(ms). 첫 진입은 3.2초짜리라 훨씬 길다. */
const RETURN_BUDGET = 1500

const measure = async (pg) => {
  await pg.evaluate(() => {
    window.__c = []
    const t = () => {
      const btn = document.querySelector('.room-marker-wrap button')
      if (btn) window.__c.push({ t: performance.now(), x: btn.getBoundingClientRect().x })
      requestAnimationFrame(t)
    }
    requestAnimationFrame(t)
  })
  await pg.waitForTimeout(4500)
  const c = await pg.evaluate(() => window.__c || [])
  if (!c.length) return null
  const last = c.at(-1)
  for (let i = c.length - 1; i > 0; i--) {
    if (Math.abs(c[i].x - last.x) > 3) return Math.round(c[i + 1].t - c[0].t)
  }
  return 0
}

;(async () => {
  const b = await chromium.launch({ headless: false })
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  let fail = 0

  await pg.goto('http://localhost:3200/', { waitUntil: 'domcontentloaded' })
  const first = await measure(pg)
  await pg.goto('http://localhost:3200/work', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(1200)
  await pg.goto('http://localhost:3200/', { waitUntil: 'domcontentloaded' })
  const back = await measure(pg)

  const ok = back !== null && back <= RETURN_BUDGET
  if (!ok) fail++
  console.log(`  - 첫 진입 비행 ${first}ms (연출이므로 길어도 된다)`)
  console.log(`  ${ok ? '✓' : '✗'} 복귀 비행 ${back}ms (예산 ${RETURN_BUDGET}ms)`)

  await b.close()
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
