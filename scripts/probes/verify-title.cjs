// 제목이 보였다가 다시 감춰지지 않는가 — SplitText 낱글자가 opacity 0 에서 출발하면 읽히던 LCP 제목이 사라진다.
// 절대 기준이 아니라 보이던 것이 어두워지는지로 판정한다(0.25 까지만 떨어져도 화면에선 보인다).
// 시각은 네비게이션 시작 기준 — evaluate 시점을 0 으로 잡으면 앞쪽이 빠진다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
const PATHS = ['/', '/work', '/career', '/stack']

const INIT = () => {
  window.__rec = []
  const tick = () => {
    const h = document.querySelector('h1')
    if (h) {
      // 낱글자는 자식 없는 잎 span — 단어 래퍼를 세면 늘 1 이 나와 아무것도 못 잡는다
      const g = [...h.querySelectorAll('span')].filter((s) => s.childElementCount === 0)
      let vis = 1
      if (g.length) {
        vis = 0
        for (const s of g) vis += Number.parseFloat(getComputedStyle(s).opacity)
        vis /= g.length
      }
      // 조상이 투명하면 화면에서는 안 보인다
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
      // 한 번 다 보인 뒤(0.99 이상) 0.6 아래로 떨어지면 감춰진 것
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
