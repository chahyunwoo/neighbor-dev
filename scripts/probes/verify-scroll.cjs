// 문서가 화면보다 길면 끝까지 내려가는가 — verify-noscroll 과 짝(그쪽은 스크롤바가 안 생기는지 본다).
// window.scrollTo 로 재지 않는다 — clip 에서도 프로그램 스크롤은 먹을 수 있어 실제 휠로 잰다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
const PAGES = [
  '/',
  '/work',
  '/work/claude-board',
  '/career',
  '/stack',
  '/team',
  '/contact',
  '/diagnose',
]
// 끝에서 이만큼 못 미치면 실패 — 감쇠·앵커링 여유
const TOL = 8

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 420, height: 844 },
  ]) {
    const ctx = await b.newContext({ viewport: vp })
    const pg = await ctx.newPage()
    for (const p of PAGES) {
      await pg.goto(BASE + p, { waitUntil: 'load' })
      await pg.waitForTimeout(p === '/' ? 4000 : 1200)
      const m = await pg.evaluate(() => ({
        sh: document.documentElement.scrollHeight,
        ch: document.documentElement.clientHeight,
      }))
      const maxY = m.sh - m.ch
      if (maxY <= TOL) {
        console.log(`  ✓ ${String(vp.width).padStart(4)}  ${p.padEnd(20)} 한 화면에 담긴다`)
        continue
      }
      await pg.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2))
      for (let i = 0; i < Math.ceil(maxY / 150) + 6; i++) await pg.mouse.wheel(0, 200)
      await pg.waitForTimeout(500)
      const y = await pg.evaluate(() => Math.round(window.scrollY))
      const ok = y >= maxY - TOL
      if (!ok) fail++
      console.log(
        `  ${ok ? '✓' : '✗'} ${String(vp.width).padStart(4)}  ${p.padEnd(20)} 끝 ${String(maxY).padStart(5)} · 휠로 간 곳 ${String(y).padStart(5)}${ok ? '' : `  ← ${maxY - y}px 못 감`}`,
      )
    }
    await ctx.close()
  }
  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n모든 화면이 문서 끝까지 내려간다')
  process.exit(fail ? 1 : 0)
})()
