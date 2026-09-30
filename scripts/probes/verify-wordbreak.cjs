// 한국어 어절이 중간에서 줄바꿈되는가 — 붙은 두 한글 글자 사이에서 줄이 바뀌면 한 건. 데스크톱·모바일 폭 둘 다.
// 돌리는 법: node scripts/probes/verify-wordbreak.cjs
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

const PAGES = [
  '/',
  '/work',
  '/work/claude-board',
  '/stack',
  '/team',
  '/career',
  '/contact',
  '/diagnose',
]
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 420, height: 900 },
]

const COUNT = () => {
  const HANGUL = /[가-힣]/
  const hits = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement
    if (!el || el.closest('.canvas-shell, script, style, [aria-hidden="true"]')) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const t = node.textContent
    let prevTop = null
    for (let i = 0; i < t.length; i++) {
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const r = range.getClientRects()[0]
      if (!r || r.width === 0) {
        prevTop = null
        continue
      }
      if (prevTop !== null && r.top > prevTop + 2 && HANGUL.test(t[i]) && HANGUL.test(t[i - 1])) {
        hits.push(`${t.slice(Math.max(0, i - 6), i)} / ${t.slice(i, i + 6)}`)
      }
      prevTop = r.top
    }
  }
  return hits
}

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let total = 0
  for (const vp of VIEWPORTS) {
    const pg = await (await b.newContext({ viewport: vp })).newPage()
    for (const p of PAGES) {
      await pg.goto(`${BASE}${p}`, { waitUntil: 'networkidle' })
      await pg.waitForTimeout(1500)
      const hits = await pg.evaluate(COUNT)
      total += hits.length
      const mark = hits.length ? '✗' : '✓'
      console.log(
        `  ${mark} ${String(vp.width).padStart(4)} ${p.padEnd(20)} ${hits.length}건${hits.length ? `  예: ${hits.slice(0, 2).join(' | ')}` : ''}`,
      )
    }
    await pg.context().close()
  }
  await b.close()
  console.log(
    total ? `\n어절 중간 줄바꿈 ${total}건` : '\n전부 통과 — 어절 중간에서 줄이 바뀌지 않는다',
  )
  process.exit(total ? 1 : 0)
})()
