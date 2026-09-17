/**
 * **문서가 화면보다 길면 끝까지 내려가는가.**
 *
 * 🔴 이 검사가 없어서 못 잡은 것 (2026-09-17): 데스크톱에서 **하위 화면이
 *    전부 스크롤되지 않았다.** `/work` 는 문서 2461px 중 **1561px 이 잘려**
 *    사례 카드 대부분을 못 봤다. 검사기 20종이 전부 초록이었다.
 *
 *    원인은 `body { overflow-y: clip }` — 이슈 #24(스크롤바 깜빡임)를 막으려고
 *    넣은 방어인데, 그 근거(`template.tsx` 의 `pageIn`)가 #35 에서 사라진 뒤에도
 *    남아 있었다.
 *
 * 🔴 **`verify-noscroll` 과 정확히 반대 방향이다.** 그쪽은 "스크롤바가
 *    **생기지 않는가**" 를 본다. 방어를 만들 때 그 방어가 **무엇을 깨뜨리는지**
 *    같이 재지 않으면 이런 것이 남는다. 둘은 짝이다.
 *
 * ⚠️ **`window.scrollTo` 로 재지 않는다.** 프로그램 스크롤은 `clip` 에서도
 *    먹는 경우가 있어 **실제 휠**로 재야 한다 — 실측: `scrollTo` 는 438px 까지
 *    갔는데 휠은 0px 이었다.
 */
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
/** 끝에서 이만큼 못 미치면 실패. 감쇠·앵커링 여유. */
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
      // 🔴 실제 휠로 내린다.
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
