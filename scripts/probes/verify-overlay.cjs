/**
 * 이슈 #8 — 3D 가 본문을 덮지 않는가.
 *
 * 🔴 정적 검사기로는 못 잡는다. `--cv-left`·마스크·투명도가 전부 제대로
 *    걸려 있어도 **본문 폭이 안 줄면** 3D 가 글씨 위에 얹힌다.
 *    화면을 열어 두 영역이 실제로 겹치는지 잰다.
 */
const { chromium } = require('./_pw.cjs')
const PAGES = ['/work', '/work/claude-board', '/career', '/stack', '/team', '/contact', '/diagnose']
/** 캔버스 왼쪽 가장자리에서 이만큼은 본문이 들어와도 봐준다(마스크가 투명한 구간). */
const SLACK = 40

;(async () => {
  const b = await chromium.launch()
  let fail = 0
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    const pg = await (await b.newContext({ viewport: vp })).newPage()
    for (const p of PAGES) {
      await pg.goto(`http://localhost:3200${p}`, { waitUntil: 'networkidle' })
      await pg.waitForTimeout(2600)
      const r = await pg.evaluate((slack) => {
        const c = document.querySelector('canvas')
        if (!c) return { skip: true }
        const cb = c.getBoundingClientRect()
        const names = []
        let n = 0
        document.querySelectorAll('main *').forEach((e) => {
          if (e.children.length) return
          const t = e.textContent?.trim()
          if (!t) return
          const r = e.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return
          if (r.right > cb.left + slack && r.top < cb.bottom && r.bottom > cb.top) {
            n++
            if (names.length < 3) names.push(t.slice(0, 12))
          }
        })
        return { n, names, cx: Math.round(cb.left) }
      }, SLACK)
      if (r.skip) {
        console.log(`  - ${vp.width} ${p.padEnd(20)} (3D 없음)`)
        continue
      }
      const ok = r.n === 0
      if (!ok) fail++
      console.log(
        `  ${ok ? '✓' : '✗'} ${vp.width} ${p.padEnd(20)} 덮인 본문 ${r.n}개 ${r.names.join(',')}`,
      )
    }
    await pg.close()
  }
  await b.close()
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
