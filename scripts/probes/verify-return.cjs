// 복귀 비행이 짧고 곧게 끝나는가 — goto 가 아니라 링크 클릭(클라이언트 내비게이션)으로, 목록·상세·직접 진입 경로를 다 본다.
// 서로 다른 시계로 움직이는 항의 겹침은 정착 시간뿐 아니라 방향반전과 되돌아온 거리로 잰다.
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

// 복귀 비행 예산(ms).
const RETURN_BUDGET = 1500
// 곧게 날아도 투영 x 의 회전 성분으로 한 번은 꺾일 수 있다.
const MAX_FLIPS = 1
// 되돌아온 거리/전체 이동. 전환 두 경로 실측 0.0%(3회) × 2 가 0 이라 반올림 흔들림을 받는 하한 1% 를 둔다. dev 는 2.2~15% 였다.
const MAX_BACKTRACK = 0.01
// 방향 판정에서 무시하는 이동(px) — 정착 후 미세 진동 오탐 방지
const NOISE = 0.5

// 앞서 돌던 rAF 루프를 반드시 멈춘다 — 루프가 겹치면 샘플이 섞여 없는 방향 반전이 만들어진다
const track = (pg) =>
  pg.evaluate(() => {
    window.__gen = (window.__gen ?? 0) + 1
    const mine = window.__gen
    window.__c = []
    const t = () => {
      if (window.__gen !== mine) return // 새 세대가 시작됐다 — 이 루프는 끝낸다
      const btn = document.querySelector('.room-marker-wrap button')
      if (btn)
        window.__c.push({ t: performance.now(), x: +btn.getBoundingClientRect().x.toFixed(2) })
      requestAnimationFrame(t)
    }
    requestAnimationFrame(t)
  })

const measure = async (pg) => {
  const c = await pg.evaluate(() => window.__c || [])
  if (c.length < 3) return null
  const t0 = c[0].t
  const last = c.at(-1)
  const tail = c.filter((s) => s.t >= last.t - 300)
  if (last.t - t0 < 300 || tail.some((s) => Math.abs(s.x - last.x) > 3)) return null

  let settle = 0
  for (let i = c.length - 1; i > 0; i--) {
    if (Math.abs(c[i].x - last.x) > 3) {
      settle = Math.round(c[i + 1].t - t0)
      break
    }
  }

  // 정착 전 구간만 센다 — 정착 후 투영 반올림 흔들림을 세면 노이즈가 압도한다
  const moving = c.filter((s) => s.t - t0 <= settle)

  let flips = 0
  let dir = 0
  let positive = 0
  let negative = 0
  for (let i = 1; i < moving.length; i++) {
    const d = moving[i].x - moving[i - 1].x
    if (Math.abs(d) < NOISE) continue
    const nd = Math.sign(d)
    if (nd > 0) positive += d
    else negative -= d
    if (dir !== 0 && nd !== dir) flips++
    dir = nd
  }
  const distance = positive + negative
  if (!distance) return null
  const backtrack = Math.min(positive, negative) / distance
  return { settle, flips, backtrack, frames: c.length }
}

// goto 가 아니라 방문자가 하듯 링크를 눌러 이동한다
const clickNav = async (pg, sel) => {
  const path = await pg.$eval(sel, (el) => {
    const path = new URL(el.href).pathname
    el.click()
    return path
  })
  await pg.waitForURL((u) => u.pathname === path)
  await pg.waitForFunction(
    (mode) => document.documentElement.dataset.canvasMode === mode,
    path === '/' ? 'room' : 'object',
  )
}

;(async () => {
  const b = await chromium.launch(LAUNCH)
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  let fail = 0

  // 입장 연출은 원래 곡선으로 날아 비율 판정에서 뺀다 — 첫 진입 기준선이 30~42% 다.
  const check = async (label, budget, page = pg, judgeBacktrack = true) => {
    const m = await measure(page)
    if (!m) {
      fail++
      console.log(`  ✗ ${label} — 유효한 이동 구간을 읽지 못했다(샘플 부족·이동 없음·정착 미완료)`)
      return
    }
    const okTime = m.settle <= budget
    const okLine = m.flips <= MAX_FLIPS
    const okBacktrack = !judgeBacktrack || m.backtrack <= MAX_BACKTRACK
    if (!okTime || !okLine || !okBacktrack) fail++
    console.log(
      `  ${okTime && okLine && okBacktrack ? '✓' : '✗'} ${label} — 정착 ${m.settle}ms (예산 ${budget}) · 방향반전 ${m.flips}회 (허용 ${MAX_FLIPS}) · 되돌아온 비율 ${(m.backtrack * 100).toFixed(1)}% (허용 ${judgeBacktrack ? `${(MAX_BACKTRACK * 100).toFixed(1)}%` : '판정 안 함'}) · 샘플 ${m.frames}개`,
    )
    if (!okLine || !okBacktrack)
      console.log('      서로 다른 시계로 움직이는 항의 겹침 여부를 확인한다')
  }

  // 1) 첫 진입 — 연출이므로 길어도 된다. 기준선으로만 찍는다
  await pg.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await track(pg)
  await pg.waitForTimeout(5000)
  const first = await measure(pg)
  console.log(
    `  - 첫 진입 비행 ${first ? first.settle : '?'}ms · 되돌아온 비율 ${first ? (first.backtrack * 100).toFixed(1) : '?'}% (연출 기준선)`,
  )

  // 2) 목록 → 홈 3) 상세 → 홈, 로고 클릭
  const returns = async (page, tag) => {
    await clickNav(page, 'nav a[href="/work"]')
    await page.waitForTimeout(2500)
    await track(page)
    await clickNav(page, 'nav a[href="/"]')
    await page.waitForTimeout(5000)
    await check(`목록 → 로고 → 홈${tag}`, RETURN_BUDGET, page)

    await clickNav(page, 'nav a[href="/work"]')
    await page.waitForTimeout(2000)
    await clickNav(page, 'a[href^="/work/"]')
    await page.waitForTimeout(3000)
    await track(page)
    await clickNav(page, 'nav a[href="/"]')
    await page.waitForTimeout(5000)
    await check(`상세 → 로고 → 홈${tag}`, RETURN_BUDGET, page)
  }
  await returns(pg, '')

  // 4) 상세로 직접 진입한 뒤 복귀 — 같은 탭이면 sessionStorage 의 intro-seen 이 남아 조건이 달라져 새 컨텍스트에서 연다
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const pg2 = await ctx2.newPage()
  await pg2.goto(`${BASE}/work/claude-board`, { waitUntil: 'networkidle' })
  await pg2.waitForTimeout(3000)
  await track(pg2)
  await clickNav(pg2, 'nav a[href="/"]')
  await pg2.waitForTimeout(6000)
  await check('상세 직접진입 → 로고 → 홈', 2000, pg2, false)

  // 5) 스크롤바가 자리를 차지하는 환경 — headless 는 기본으로 숨겨 하위 화면에서만 생기는 15px 폭 변화를 못 본다
  const b2 = await chromium.launch({ ...LAUNCH, ignoreDefaultArgs: ['--hide-scrollbars'] })
  const pg3 = await (await b2.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await pg3.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style')
      s.textContent = '::-webkit-scrollbar{width:15px;height:15px}'
      document.head.append(s)
    })
  })
  await pg3.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await pg3.waitForTimeout(5000)
  await returns(pg3, ' (스크롤바)')
  await b2.close()

  await b.close()
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
