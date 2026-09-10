/**
 * 이슈 #9 — 좁은 화면에서 목록이 잘리지 않는가.
 *
 * 🔴 3D 가 꺼지는 구간에서 번호 목록은 **유일한 이동 수단**이다.
 *    잘리면 그 물건으로 갈 방법이 아예 없어진다.
 */
const { chromium } = require('./_pw.cjs')
const VPS = [
  [390, 844],
  [430, 932],
  [768, 1024],
  [800, 900],
  [880, 900],
  [901, 900],
  [1440, 900],
]
;(async () => {
  const b = await chromium.launch()
  let fail = 0
  for (const [w, h] of VPS) {
    const ctx = await b.newContext({
      viewport: { width: w, height: h },
      isMobile: w < 800,
      hasTouch: w < 800,
    })
    const pg = await ctx.newPage()
    await pg.goto('http://localhost:3200/', { waitUntil: 'networkidle' })
    await pg.waitForTimeout(3200)
    const r = await pg.evaluate(() => {
      const p = document.querySelector('[class*="page-module"]')
      const clip = p ? p.scrollHeight - Math.round(p.getBoundingClientRect().height) : 0
      // 물건 링크가 전부 닿는가 (스크롤해서라도)
      const links = [...document.querySelectorAll('main a[href^="/"]')]
      return {
        canvas: document.querySelectorAll('canvas').length,
        clip,
        links: links.length,
        scrollable: document.documentElement.scrollHeight > window.innerHeight,
      }
    })
    // 3D 가 있으면 한 화면 고정이 정상, 없으면 잘리면 안 된다
    const ok = r.canvas > 0 ? true : r.clip <= 0
    if (!ok) fail++
    console.log(
      `  ${ok ? '✓' : '✗'} ${String(w).padStart(4)}x${h}  canvas=${r.canvas}  잘림=${r.clip}px  링크=${r.links}`,
    )
    await ctx.close()
  }
  await b.close()
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
