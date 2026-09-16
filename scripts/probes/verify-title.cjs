/**
 * 제목이 **보였다가 다시 감춰지지 않는가.**
 *
 * 🔴 이 검사가 없어서 못 잡은 것 (2026-09-16):
 *
 *    `SplitText` 는 서버에서 원문을 통째로 렌더한 뒤 클라이언트에서 낱글자로
 *    갈아끼운다. 그 낱글자가 `opacity: 0` 에서 출발하면 **이미 읽히고 있던
 *    제목이 도로 사라진다.** 화면에서 제일 큰 글자가 구멍이 되고, 그게 대개
 *    LCP 요소다. 검색 유입이 곧 수주 경로인 사이트에서 치명적이다.
 *
 * 🔴 **판정은 "완전히 안 보이는가" 가 아니라 "보이던 것이 어두워지는가" 다.**
 *    절대 기준(`< 0.02`)으로 뒀더니 `/` 만 잡히고 `/work`·`/stack` 은
 *    0.25 까지만 떨어져 **초록으로 통과했다**(실측). 0.25 도 화면에서는
 *    "제목이 흐려졌다 돌아온다" 로 또렷이 보인다.
 *
 * ⚠️ **낱글자는 잎 노드 `span` 이다.** 바깥 단어 래퍼(`aria-hidden` 이 붙은
 *    줄바꿈 방지용 `span`)를 재면 **늘 1 이 나와 아무것도 못 잡는다** —
 *    실제로 그렇게 재다가 "무력화해도 안 잡힌다" 는 틀린 결론을 냈다.
 *
 * ⚠️ 시각은 **네비게이션 시작 기준**이다. `evaluate` 시점을 0 으로 잡으면
 *    앞쪽 200ms 가 통째로 빠져 짧게 나온다.
 */
const { chromium, LAUNCH } = require('./_pw.cjs')
const BASE = process.env.WEB_BASE_URL || 'http://localhost:3200'
const PATHS = ['/', '/work', '/career', '/stack']

const INIT = () => {
  window.__rec = []
  const tick = () => {
    const h = document.querySelector('h1')
    if (h) {
      // 낱글자 = 자식 요소가 없는 span. 단어 래퍼를 세면 늘 1 이다.
      const g = [...h.querySelectorAll('span')].filter((s) => s.childElementCount === 0)
      let vis = 1
      if (g.length) {
        vis = 0
        for (const s of g) vis += Number.parseFloat(getComputedStyle(s).opacity)
        vis /= g.length
      }
      // 조상이 투명하면 화면에서는 안 보인다(예전 `template.tsx` 가 그랬다).
      let el = h
      while (el) {
        vis *= Number.parseFloat(getComputedStyle(el).opacity)
        el = el.parentElement
      }
      window.__rec.push({ t: Math.round(performance.now()), vis: +vis.toFixed(3), n: g.length })
    }
    if (performance.now() < 3500) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  for (const reduced of [false, true]) {
    for (const p of PATHS) {
      const ctx = await b.newContext({
        viewport: { width: 1440, height: 900 },
        ...(reduced ? { reducedMotion: 'reduce' } : {}),
      })
      const pg = await ctx.newPage()
      await pg.addInitScript(INIT)
      await pg.goto(BASE + p, { waitUntil: 'load' })
      await pg.waitForTimeout(3600)
      const f = await pg.evaluate(() => window.__rec)
      await ctx.close()

      const label = `${p}${reduced ? ' (reduce)' : ''}`
      if (!f.length) {
        fail++
        console.log(`  ✗ ${label.padEnd(18)} h1 을 한 프레임도 못 봤다`)
        continue
      }
      // 한 번 다 보인 뒤(≥0.99) 60% 아래로 떨어지면 "감춰졌다" 로 본다.
      let seen = false
      let dip = null
      for (const x of f) {
        if (x.vis >= 0.99) seen = true
        else if (seen && x.vis < 0.6 && dip === null) dip = x
      }
      const first = f.find((x) => x.vis >= 0.99)
      if (dip) {
        fail++
        console.log(
          `  ✗ ${label.padEnd(18)} ${first.t}ms 에 다 보였는데 ${dip.t}ms 에 ${dip.vis} 로 떨어졌다`,
        )
      } else {
        console.log(
          `  ✓ ${label.padEnd(18)} 감춰지는 프레임 0개 · 완전표시 ${first ? `${first.t}ms` : '없음'}`,
        )
      }
    }
  }
  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과 — 제목은 한 번 나온 뒤 감춰지지 않는다')
  process.exit(fail ? 1 : 0)
})()
