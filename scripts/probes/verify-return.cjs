// 복귀 비행이 짧고 곧게 끝나는가 — goto 가 아니라 링크 클릭(클라이언트 내비게이션)으로, 목록·상세·직접 진입 경로를 다 본다.
// 정착 시간만으로는 지그재그(비행이 매 프레임 다시 시작)를 못 봐 마커 진행 방향이 뒤집히는 횟수를 함께 센다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

// 복귀 비행 예산(ms). 첫 진입은 4.2초짜리 연출이라 훨씬 길다
const RETURN_BUDGET = 1500
// 0 이 아니다 — 곧게 날아도 투영 x 가 회전 성분으로 한 번은 꺾일 수 있다. 그 이상은 비행이 다시 시작된 것
const MAX_FLIPS = 1
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

  let settle = 0
  for (let i = c.length - 1; i > 0; i--) {
    if (Math.abs(c[i].x - last.x) > 3) {
      settle = Math.round(c[i + 1].t - t0)
      break
    }
  }

  // 정착 전 구간만 센다 — 정착 후 투영 반올림 흔들림을 세면 노이즈가 압도한다
  const until = c.findIndex((s) => s.t - t0 > settle)
  const moving = until > 2 ? c.slice(0, until) : c

  let flips = 0
  let dir = 0
  for (let i = 1; i < moving.length; i++) {
    const d = moving[i].x - moving[i - 1].x
    if (Math.abs(d) < NOISE) continue
    const nd = Math.sign(d)
    if (dir !== 0 && nd !== dir) flips++
    dir = nd
  }
  return { settle, flips, frames: c.length }
}

// goto 가 아니라 방문자가 하듯 링크를 눌러 이동한다
const clickNav = (pg, sel) => pg.$eval(sel, (el) => el.click())

;(async () => {
  const b = await chromium.launch(LAUNCH)
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  let fail = 0

  const check = async (label, budget) => {
    const m = await measure(pg)
    if (!m) {
      fail++
      console.log(`  ✗ ${label} — 마커를 한 번도 못 봤다(샘플 부족)`)
      return
    }
    const okTime = m.settle <= budget
    const okLine = m.flips <= MAX_FLIPS
    if (!okTime || !okLine) fail++
    console.log(
      `  ${okTime && okLine ? '✓' : '✗'} ${label} — 정착 ${m.settle}ms (예산 ${budget}) · 방향반전 ${m.flips}회 (허용 ${MAX_FLIPS})`,
    )
    if (!okLine) console.log('      비행이 도중에 다시 시작된다 — 경로가 지그재그다(#88)')
  }

  // 1) 첫 진입 — 연출이므로 길어도 된다. 기준선으로만 찍는다
  await pg.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await track(pg)
  await pg.waitForTimeout(5000)
  const first = await measure(pg)
  console.log(`  - 첫 진입 비행 ${first ? first.settle : '?'}ms (연출이므로 길어도 된다)`)

  // 2) 목록 → 홈, 로고 클릭
  await clickNav(pg, 'nav a[href="/work"]')
  await pg.waitForTimeout(2500)
  await clickNav(pg, 'nav a[href="/"]')
  await track(pg)
  await pg.waitForTimeout(5000)
  await check('목록 → 로고 → 홈', RETURN_BUDGET)

  // 3) 상세 → 홈, 로고 클릭
  await clickNav(pg, 'nav a[href="/work"]')
  await pg.waitForTimeout(2000)
  await clickNav(pg, 'a[href^="/work/"]')
  await pg.waitForTimeout(3000)
  await clickNav(pg, 'nav a[href="/"]')
  await track(pg)
  await pg.waitForTimeout(5000)
  await check('상세 → 로고 → 홈', RETURN_BUDGET)

  // 4) 상세로 직접 진입한 뒤 복귀 — 같은 탭이면 sessionStorage 의 intro-seen 이 남아 조건이 달라져 새 컨텍스트에서 연다
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const pg2 = await ctx2.newPage()
  await pg2.goto(`${BASE}/work/claude-board`, { waitUntil: 'networkidle' })
  await pg2.waitForTimeout(3000)
  await clickNav(pg2, 'nav a[href="/"]')
  await track(pg2)
  await pg2.waitForTimeout(6000)
  {
    const m = await measure(pg2)
    // 방을 처음 보는 경로라 입장 연출이 도는 것이 맞지만, 4.2초 전체를 다시 돌면 안 된다
    const budget = 4000
    const okTime = m && m.settle <= budget
    const okLine = m && m.flips <= MAX_FLIPS
    if (!okTime || !okLine) fail++
    console.log(
      `  ${okTime && okLine ? '✓' : '✗'} 상세 직접진입 → 로고 → 홈 — 정착 ${m ? m.settle : '?'}ms (예산 ${budget}) · 방향반전 ${m ? m.flips : '?'}회 (허용 ${MAX_FLIPS})`,
    )
  }

  await b.close()
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
