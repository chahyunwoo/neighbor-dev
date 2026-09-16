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
const { chromium, LAUNCH } = require('./_pw.cjs')
const BASE = process.env.WEB_BASE_URL || 'http://localhost:3200'
const PAGES = ['/', '/work', '/stack', '/career', '/team', '/diagnose', '/contact']
/** 반올림 오차만 허용한다. */
const TOL = 1

const CASES = [
  { label: '3D 켜짐 1440', vp: { width: 1440, height: 900 } },
  { label: 'reduced 1440', vp: { width: 1440, height: 900 }, reduced: true },
  { label: '좁은 화면 420', vp: { width: 420, height: 844 } },
]

const READ = () => {
  const d = document.documentElement
  const over = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.right > d.clientWidth + 1) {
      over.push(
        `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0].slice(-18)}(${Math.round(r.right)})`,
      )
    }
  }
  return { sw: d.scrollWidth, cw: d.clientWidth, over: over.slice(0, 3) }
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
      const diff = r.sw - r.cw
      const ok = diff <= TOL
      if (!ok) fail++
      console.log(
        `  ${ok ? '✓' : '✗'} ${c.label.padEnd(13)} ${p.padEnd(10)} scrollWidth ${r.sw} / clientWidth ${r.cw}${ok ? '' : `  → ${diff}px 넘침 · 범인 ${r.over.join(' ')}`}`,
      )
    }
    await ctx.close()
  }
  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n가로로 넘치는 화면이 없다')
  process.exit(fail ? 1 : 0)
})()
