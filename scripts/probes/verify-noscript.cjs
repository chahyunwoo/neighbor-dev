/**
 * JS 가 없을 때도 **글이 읽히고 갈 곳이 보이는가** (기획서 4절 폴백 3단의 마지막 단).
 *
 * 🔴 두 가지가 각각 화면을 비운다. 하나만 막으면 안 잡힌다:
 *
 *    ① **Motion 의 인라인 `opacity:0`** — 서버 HTML 에 그대로 실린다
 *       (실측: `/work` 에 `style="opacity:0;transform:translateY(14px)"` 18건).
 *       JS 가 켜지면 애니메이션이 풀지만 꺼져 있으면 영영 투명하다.
 *
 *    ② **CSS 가 미리 접어 둔 방 목록** — `Hero.module.css` 는 데스크톱에서
 *       "어차피 JS 가 3D 를 가져온다" 는 전제로 `clip-path: inset(50%)` ·
 *       `width:1px` 을 건다. JS 가 없으면 3D 도 안 오므로 **3D 도 목록도 없는
 *       화면**이 된다. 실측 2026-09-16: `roomW=1`, 보이는 링크가
 *       `/work`·`/career`·`/contact` 뿐이라 `/stack`·`/diagnose`·`/team` 으로
 *       갈 길이 화면에서 사라졌다.
 *
 *    ①만 막는 noscript 규칙이 있었는데 ②를 못 덮고 있었다.
 */
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
/** 이 화면들로 가는 길이 홈에서 보여야 한다. 내비에는 셋뿐이다. */
const NEED = ['/career', '/contact', '/diagnose', '/stack', '/team', '/work']

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  /*
   * 🔴 대상을 넓혔다. 전에는 넷뿐이라 `/diagnose`·`/contact`·`/team` 이
   *    한 번도 안 보였다 — 검사 범위 밖은 "통과" 가 아니라 "안 본 것" 이다.
   */
  for (const p of ['/', '/work', '/career', '/stack', '/diagnose', '/contact', '/team']) {
    const ctx = await b.newContext({
      viewport: { width: 1440, height: 900 },
      javaScriptEnabled: false,
    })
    const pg = await ctx.newPage()
    await pg.goto(BASE + p, { waitUntil: 'load' })
    const r = await pg.evaluate(() => {
      /*
       * 🔴 **조상이 잘라내는 것까지 본다.**
       *    자기 `getBoundingClientRect()` 만 보면 1px 컨테이너 안에 접힌
       *    링크가 "보인다" 로 나온다 — `overflow:hidden` 은 자식의 레이아웃
       *    크기를 안 줄이고 `clip-path` 도 마찬가지다. 실측 2026-09-16:
       *    방 목록이 `width:1px · clip-path:inset(50%)` 인데 검사기는
       *    **링크 7개가 다 보인다고 초록**을 냈다.
       */
      /*
       * ⚠️ **의도된 sr-only 는 "감춰진 글" 이 아니다.** 스크린리더 전용 라이브
       *    영역은 `clip-path: inset(50%)` · 1px 로 감추는 것이 표준 수법이라,
       *    그것까지 세면 `/diagnose` 가 위양성으로 빨개진다(실측:
       *    `P.…__srOnly role=status text=""` 1건).
       */
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
