// JS 가 없을 때도 글이 읽히고 갈 곳이 보이는가. 화면을 비우는 원인이 둘이라 둘 다 본다:
// Motion 의 인라인 opacity:0(서버 HTML 에 실린다)과 CSS 가 3D 를 전제로 접어 둔 방 목록
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
// 홈에서 가는 길이 보여야 하는 화면들 — 내비에는 셋뿐이다
const NEED = ['/career', '/contact', '/diagnose', '/stack', '/team', '/work']

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  for (const p of ['/', '/work', '/career', '/stack', '/diagnose', '/contact', '/team']) {
    const ctx = await b.newContext({
      viewport: { width: 1440, height: 900 },
      javaScriptEnabled: false,
    })
    const pg = await ctx.newPage()
    await pg.goto(BASE + p, { waitUntil: 'load' })
    const r = await pg.evaluate(() => {
      // 조상이 잘라내는 것까지 본다 — overflow:hidden·clip-path 는 자식의 레이아웃 크기를 안 줄인다
      // 의도된 sr-only 라이브 영역은 감춰진 글로 세지 않는다(표준 수법이라 위양성이 난다)
      const srOnly = (e) =>
        e.closest('[role="status"],[role="alert"],[aria-live]') !== null ||
        /srOnly/.test(e.className ?? '')
      const vis = (e) => {
        if (srOnly(e)) return true
        for (let n = e; n && n !== document.documentElement; n = n.parentElement) {
          const c = getComputedStyle(n)
          const b = n.getBoundingClientRect()
          if (Number.parseFloat(c.opacity) < 0.99) return false
          if (c.visibility === 'hidden' || c.display === 'none') return false
          if (c.clipPath !== 'none') return false
          if (b.width <= 2 || b.height <= 2) return false
        }
        return true
      }
      return {
        hidden: [...document.querySelectorAll('article, h1, h2, h3, p, li')].filter((e) => !vis(e))
          .length,
        links: [
          ...new Set(
            [...document.querySelectorAll('a[href^="/"]')]
              .filter(vis)
              .map((a) => a.getAttribute('href')),
          ),
        ],
      }
    })
    await ctx.close()
    const miss = p === '/' ? NEED.filter((n) => !r.links.includes(n)) : []
    if (r.hidden || miss.length) {
      fail++
      console.log(
        `  ✗ ${p.padEnd(9)} 감춰진 글 ${r.hidden}개${miss.length ? ` · 못 가는 곳 ${miss.join(' ')}` : ''}`,
      )
    } else {
      console.log(`  ✓ ${p.padEnd(9)} 감춰진 글 0개 · 보이는 내부 링크 ${r.links.length}개`)
    }
  }
  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\nJS 없이도 전부 읽히고 갈 곳이 보인다')
  process.exit(fail ? 1 : 0)
})()
