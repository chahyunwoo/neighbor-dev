/**
 * 하위 화면(`/work`·`/stack`·…)의 **3D 배경이 실제로 보이는가.**
 *
 * 🔴 **이 검사가 없어서 브랜치 프로브 12종이 전부 초록인데 화면이 검었다**
 *    (2026-09-16). 기존 프로브는 전부 홈의 3D 만 본다 — 마커 위치, 겹침,
 *    프레임 간격. 하위 화면의 캔버스를 들여다보는 것이 하나도 없었다.
 *
 * 🔴 **WebGL 캔버스는 2D 컨텍스트로 못 읽는다**(CLAUDE.md 에 적힌 함정 —
 *    전부 0 이 나온다). 그래서 **스크린샷을 찍어** 그 이미지를 페이지 안
 *    2D 캔버스에 다시 그려 픽셀을 센다.
 *
 * ⚠️ 본문을 숨기고 캔버스만 남긴다. 안 그러면 글자 픽셀이 "3D 가 보인다" 로
 *    잘못 세어진다.
 */
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')
/** 방이 배경으로 깔리는 화면들. `data-canvas-mode="object"` 인 곳이다. */
const PAGES = ['/work', '/stack', '/career', '/team']
/** 이보다 어두우면 "사실상 검은 화면" 으로 본다. 홈은 max 255 가 나온다. */
const MIN_MAX_LUMA = 60
/** 홈경유와 직접 진입의 평균 휘도 비율 상한. 이보다 벌어지면 다른 구도다. */
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
  /** 화면별로 두 경로의 결과를 모아 둔다. */
  const seen = {}
  /*
   * 🔴 **두 경로를 다 본다.**
   *    - `홈경유` — 홈에서 링크를 눌러 온 사람
   *    - `직접`   — 검색·공유 링크로 그 주소에 바로 들어온 사람
   *    이 사이트는 검색 유입이 곧 수주 경로라 **직접이 오히려 기본 경로**다.
   */
  for (const { p, direct } of PAGES.flatMap((p) => [
    { p, direct: false },
    { p, direct: true },
  ])) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await ctx.newPage()
    await pg.goto(direct ? BASE + p : `${BASE}/`, { waitUntil: 'load' })
    await pg.waitForTimeout(6000)
    /*
     * ⚠️ **좌표 클릭을 쓰지 않는다.** 홈의 방 목록은 캔버스 **뒤**에 1px 로
     *    접혀 있어(폴백 경로) 보통 클릭은 "캔버스가 가로챈다" 며 죽고,
     *    `force` 로 밀어 넣으면 좌표가 엉뚱한 요소에 떨어져 **이동이 아예
     *    안 일어난다**(실측: /stack·/team 이 그래서 홈을 잰 채 통과했다).
     *    요소에 직접 `click()` 을 걸면 이벤트가 정상으로 올라가고
     *    `TransitionRoot` 의 문서 단계 리스너가 받는다.
     */
    if (!direct) await pg.$eval(`a[href="${p}"]`, (el) => el.click())
    /*
     * 🔴 **이동이 끝난 것을 확인하고 잰다.** 안 기다리면 홈의 캔버스
     *    (1440x733)를 재고 "정상" 이라고 초록을 낸다 — 실측으로 두 화면이
     *    그렇게 잘못 통과했다.
     */
    if (!direct) await pg.waitForURL(`**${p}`, { timeout: 15000 })
    await pg.waitForFunction(() => document.documentElement.dataset.canvasMode === 'object', null, {
      timeout: 15000,
    })
    await pg.waitForTimeout(2500)

    const box = await pg.evaluate(() => {
      // 본문을 감추고 캔버스만 남긴다.
      const s = document.createElement('style')
      s.textContent =
        '.canvas-shell{opacity:1!important}body>*:not(.canvas-shell){visibility:hidden!important}'
      document.head.appendChild(s)
      const el = document.querySelector('.canvas-shell')
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

  /*
   * 🔴 **두 경로가 비슷한 그림이어야 한다.** 밝기 기준만 두면 "둘 다 뭔가는
   *    보인다" 로 통과하는데, 실제로는 같은 주소가 진입 경로에 따라 전혀
   *    다른 구도로 나왔다(실측: 평균 휘도가 3~5배 차이).
   */
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
