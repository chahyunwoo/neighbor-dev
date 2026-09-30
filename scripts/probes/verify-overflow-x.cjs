// 가로로 넘치는 화면이 없는가. 3D 가 꺼지는 조건에서 특히 본다 — 넘침을 가리던 덮개가 3D 가부와 같은 미디어쿼리라 같이 벗겨진다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
const PAGES = ['/', '/work', '/stack', '/career', '/team', '/diagnose', '/contact']

const CASES = [
  { label: '3D 켜짐 1440', vp: { width: 1440, height: 900 } },
  { label: 'reduced 1440', vp: { width: 1440, height: 900 }, reduced: true },
  { label: '좁은 화면 420', vp: { width: 420, height: 844 } },
]

// scrollWidth 로 판정하지 않는다 — .page 의 overflow-x: clip 이 증가를 없앤다. 클리핑을 끄고 뷰포트 밖 요소를 본다
// 글자가 있는 것만 실패로 센다(빈 장식은 넘치라고 만든 것). 의사요소(::before·::after)는 못 본다
const READ = () => {
  const d = document.documentElement
  // 클리핑을 끈다 — 끄지 않으면 넘친 것이 레이아웃에서 사라진다
  const un = document.createElement('style')
  un.textContent = '*{overflow-x:visible!important;overflow:visible!important}'
  document.head.appendChild(un)
  const over = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    // 왼쪽도 본다 — scrollWidth 는 왼쪽으로 안 늘어나 대체 신호가 없다
    if (r.width <= 0) continue
    if (r.right <= d.clientWidth + 1 && r.left >= -1) continue
    // 자식이 이미 잡혔으면 조상까지 중복으로 세지 않는다.
    const text = (el.textContent ?? '').trim()
    if (!text) continue
    // 3D 마커는 뺀다 — 가장자리에 붙는 것은 의도된 클램프다(캔버스 안인지는 verify-clamp 가 본다)
    if (el.closest('.canvas-shell')) continue
    if (
      el.querySelector('*') &&
      [...el.children].some((c) => {
        const cb = c.getBoundingClientRect()
        return cb.right > d.clientWidth + 1 || cb.left < -1
      })
    )
      continue
    over.push(
      `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0].slice(-18)}[${Math.round(r.left)}..${Math.round(r.right)}] "${text.slice(0, 18)}"`,
    )
  }
  const sw = d.scrollWidth
  un.remove()
  return { sw, cw: d.clientWidth, over: over.slice(0, 3), n: over.length }
}

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  for (const c of CASES) {
    const ctx = await b.newContext({
      viewport: c.vp,
      ...(c.reduced ? { reducedMotion: 'reduce' } : {}),
    })
    const pg = await ctx.newPage()
    for (const p of PAGES) {
      await pg.goto(BASE + p, { waitUntil: 'load' })
      await pg.waitForTimeout(p === '/' ? 5000 : 1500)
      const r = await pg.evaluate(READ)
      const ok = r.n === 0
      if (!ok) fail++
      console.log(
        `  ${ok ? '✓' : '✗'} ${c.label.padEnd(13)} ${p.padEnd(10)} 클리핑 끈 폭 ${r.sw} / ${r.cw}${ok ? '' : `  → 글이 있는 요소 ${r.n}개가 밖으로: ${r.over.join(' · ')}`}`,
      )
    }
    await ctx.close()
  }
  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n가로로 넘치는 화면이 없다')
  process.exit(fail ? 1 : 0)
})()
