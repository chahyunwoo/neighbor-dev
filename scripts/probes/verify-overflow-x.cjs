/**
 * **가로로 넘치는 화면이 없는가.**
 *
 * 🔴 이 검사가 없어서 못 잡은 것 (2026-09-17): 3D 가 꺼진 홈이 가로로
 *    **122~130px** 밀렸다. 끝까지 밀면 제목과 카드의 **왼쪽이 전부 잘린다.**
 *    모바일 방문자 전원이 보는 상태였다.
 *
 * 🔴 **기존 검사는 둘 다 세로축만 봤다** — `verify-mobile` 은 `scrollHeight`,
 *    `verify-noscroll` 은 세로 스크롤바 유무. 가로를 보는 것이 하나도 없었다.
 *
 * ⚠️ **3D 가 꺼지는 조건에서 특히 본다.** 넘침을 가려주던 `body{overflow-y:clip}`
 *    의 미디어쿼리가 **3D 가부와 같은 조건**이라, 3D 가 꺼지면 덮개도 같이
 *    벗겨진다. 켜진 화면만 보면 영영 안 보인다.
 */
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
const PAGES = ['/', '/work', '/stack', '/career', '/team', '/diagnose', '/contact']

const CASES = [
  { label: '3D 켜짐 1440', vp: { width: 1440, height: 900 } },
  { label: 'reduced 1440', vp: { width: 1440, height: 900 }, reduced: true },
  { label: '좁은 화면 420', vp: { width: 420, height: 844 } },
]

/**
 * 🔴 **`scrollWidth` 로 판정하지 않는다.**
 *
 *    `.page` 의 `overflow-x: clip`(#49)이 `scrollWidth` 증가를 **없앤다.**
 *    그래서 그 안에서 진짜 본문이 넘쳐도 `sw === cw` 라 초록이 뜬다 —
 *    실측 2026-09-17: 폭 2000px 짜리 요소를 홈에 넣었더니 1580px 이 잘려
 *    나가고 가로 스크롤도 없는데(= 못 읽고 못 닿는다) **21조합 전부 통과**했다.
 *    자기와 같은 커밋의 수정이 자기 눈을 가린 셈이다.
 *
 * 🔴 **클리핑을 잠깐 끄고, 실제로 뷰포트 밖으로 나간 요소를 본다.**
 *    그리고 **글자가 있는 것만** 실패로 센다 — `.lamp` 같은 빈 장식 div 는
 *    넘치라고 만든 것이고 실제로 잘려도 아무도 못 읽을 것이 없다.
 *    "장식이 넘치는 것" 과 "본문이 잘리는 것" 을 여기서 가른다.
 *
 * ⚠️ **의사요소(`::before`·`::after`)는 못 본다** — `querySelectorAll` 에
 *    안 잡힌다. 실측 2026-09-17: `.page::after` 에 폭 2000px 을 넣어 봤더니
 *    이 검사가 통과했다. 실제 요소로 시험해야 이 게이트를 믿을 수 있다
 *    (`.hint` 를 2000px 로 만드니 `p.…__hint(2056) "드래그해서 둘러보기…"`
 *    로 정확히 잡혔다).
 */
const READ = () => {
  const d = document.documentElement
  // 클리핑을 끈다 — 끄지 않으면 넘친 것이 레이아웃에서 사라진다.
  const un = document.createElement('style')
  un.textContent = '*{overflow-x:visible!important;overflow:visible!important}'
  document.head.appendChild(un)
  const over = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    /*
     * 🔴 **왼쪽도 본다.** 오른쪽만 보다가 **글이 화면 왼쪽 밖으로 다 나가도
     *    초록**이 떴다(실측 2026-09-17: `-1200px` 로 밀어도 통과).
     *    이 검사가 잡겠다고 적어 둔 사고가 정확히 "제목과 카드의 **왼쪽이
     *    전부 잘린다**" 인데, 원 사고는 좁은 화면에서 오른쪽으로도 삐져나와
     *    우연히 잡힌 것이었다. `scrollWidth` 는 왼쪽으로 안 늘어나서
     *    대체 신호도 없다.
     */
    if (r.width <= 0) continue
    if (r.right <= d.clientWidth + 1 && r.left >= -1) continue
    // 자식이 이미 잡혔으면 조상까지 중복으로 세지 않는다.
    const text = (el.textContent ?? '').trim()
    if (!text) continue
    /*
     * ⚠️ 3D 마커는 뺀다. `.canvas-shell` 은 `position: fixed` 로 뷰포트에
     *    맞춰 잘리는 레이어이고, 마커가 가장자리에 붙는 것은 **의도된
     *    클램프**다(이슈 #3). 라벨이 몇 px 걸치는 것을 여기서 세면
     *    "본문이 잘린다" 와 구별이 안 된다 — 실측 2026-09-17:
     *    현관문 라벨이 1449px(9px 초과)로 잡혔다.
     *    마커가 캔버스 안에 있는지는 `verify-clamp` 가 따로 본다.
     */
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
