// 하위 화면의 3D 배경이 실제로 보이는가. WebGL 캔버스는 2D 컨텍스트로 못 읽어(전부 0) 스크린샷 픽셀을 센다.
// 본문을 숨기고 캔버스만 남긴다 — 안 그러면 글자 픽셀이 3D 로 세어진다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
// 방이 배경으로 깔리는 화면(data-canvas-mode="object")
const PAGES = ['/work', '/stack', '/career', '/team']
// 최대 휘도가 이보다 낮으면 사실상 검은 화면(홈은 255)
const MIN_MAX_LUMA = 60
// 홈경유와 직접 진입의 평균 휘도 배율 상한 — 넘으면 다른 구도다
const RATIO = 1.8

const STATS = (b64) =>
  new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')
      x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      let sum = 0
      let max = 0
      let n = 0
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        sum += l
        if (l > max) max = l
        n++
      }
      res({ mean: +(sum / n).toFixed(1), max: Math.round(max) })
    }
    img.src = `data:image/png;base64,${b64}`
  })

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  const seen = {}
  // 홈경유와 직접 진입을 둘 다 본다 — 검색·공유 링크로 바로 들어오는 직접이 오히려 기본 경로다
  for (const { p, direct } of PAGES.flatMap((p) => [
    { p, direct: false },
    { p, direct: true },
  ])) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await ctx.newPage()
    await pg.goto(direct ? BASE + p : `${BASE}/`, { waitUntil: 'load' })
    await pg.waitForTimeout(6000)
    // 좌표 클릭·force 를 쓰지 않는다 — 방 목록이 캔버스 뒤에 접혀 있어 이동이 안 일어난다. 요소에 click() 을 건다
    if (!direct) await pg.$eval(`a[href="${p}"]`, (el) => el.click())
    // 이동이 끝난 것을 확인하고 잰다 — 안 기다리면 홈 캔버스를 재고 통과한다
    if (!direct) await pg.waitForURL(`**${p}`, { timeout: 15000 })
    await pg.waitForFunction(() => document.documentElement.dataset.canvasMode === 'object', null, {
      timeout: 15000,
    })
    await pg.waitForTimeout(2500)

    const box = await pg.evaluate(() => {
      const s = document.createElement('style')
      s.textContent =
        '.canvas-shell{opacity:1!important}body>*:not(.canvas-shell){visibility:hidden!important}'
      document.head.appendChild(s)
      // 3D 가 보이는 영역은 캔버스(뷰포트 전체)가 아니라 .canvas-frame 이다
      const el = document.querySelector('.canvas-frame')
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    await pg.waitForTimeout(300)
    const shot = (await pg.screenshot({ clip: box })).toString('base64')
    const st = await pg.evaluate(STATS, shot)
    await ctx.close()

    seen[p] ??= {}
    seen[p][direct ? 'direct' : 'via'] = st
    const ok = st.max >= MIN_MAX_LUMA
    if (!ok) fail++
    console.log(
      `  ${ok ? '✓' : '✗'} ${p.padEnd(8)} ${(direct ? '직접' : '홈경유').padEnd(4)} 캔버스 ${Math.round(box.width)}x${Math.round(box.height)} · 평균휘도 ${st.mean} · 최대 ${st.max}${ok ? '' : `  (기준 ${MIN_MAX_LUMA} 미만 — 사실상 검은 화면)`}`,
    )
  }
  await b.close()

  // 두 경로가 비슷한 그림이어야 한다 — 밝기 기준만 두면 구도가 전혀 달라도 통과한다
  for (const [p, v] of Object.entries(seen)) {
    if (!v.via || !v.direct) continue
    const lo = Math.min(v.via.mean, v.direct.mean)
    const hi = Math.max(v.via.mean, v.direct.mean)
    const ratio = hi / Math.max(lo, 0.01)
    const ok = ratio <= RATIO
    if (!ok) fail++
    console.log(
      `  ${ok ? '✓' : '✗'} ${p.padEnd(8)} 두 경로 평균휘도 ${v.via.mean} vs ${v.direct.mean} (배율 ${ratio.toFixed(1)}, 허용 ${RATIO})`,
    )
  }
  console.log(
    fail ? `\n실패 ${fail}건` : '\n하위 화면의 3D 가 두 진입 경로에서 모두 같은 그림으로 보인다',
  )
  process.exit(fail ? 1 : 0)
})()
