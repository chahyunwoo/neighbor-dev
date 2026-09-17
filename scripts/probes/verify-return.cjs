/**
 * 이슈 #15·#88 — 복귀 비행이 **짧고 곧게** 끝나는가.
 *
 * 🔴 **GPU 플래그로 연다**(`_pw.cjs` 의 `LAUNCH`). 기본 headless 는 SwiftShader 로
 *    떨어져 프레임이 안 나오고, 그러면 카메라 비행 자체를 못 본다
 *    (이 저장소가 그 오진을 두 번 밟았다).
 *
 * 🔴 **`pg.goto` 로만 재지 않는다** (#88).
 *    전에는 전체 리로드로 `/work → /` 하나만 쟀다. 그래서
 *    **로고 클릭(클라이언트 내비게이션)** 도 **상세(`/work/<id>`) → 홈** 도
 *    검사 밖이었고, 사용자가 "덜덜 떨리면서 제자리로 간다" 고 지적하고서야 찾았다.
 *    실제 방문자는 `goto` 로 이동하지 않는다 — 링크를 누른다.
 *
 * 🔴 **정착 시간만으로는 지그재그를 못 본다** (#88).
 *    라우트 전환 중 캔버스가 25프레임에 걸쳐 커지는데, 초점 effect 의 deps 에
 *    `size` 가 있어 **매 프레임 비행이 처음부터 다시 시작**됐다. 카메라가 목표로
 *    가다 말다를 반복하는데 **총 소요는 예산 안**이라 옛 판정은 초록이었다.
 *    → 마커가 진행하는 **방향이 몇 번 뒤집히는지**를 함께 본다.
 */
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

/** 복귀 비행은 이 안에 끝나야 한다(ms). 첫 진입은 4.2초짜리 연출이라 훨씬 길다. */
const RETURN_BUDGET = 1500
/**
 * 마커 진행 방향이 뒤집혀도 되는 횟수.
 *
 * ⚠️ **0 이 아니다.** 비행은 easing 이 걸려 있고 마커는 3D 좌표의 화면 투영이라,
 *    카메라가 곧게 날아도 투영 x 가 한 번은 꺾일 수 있다(회전 성분). 그 이상은
 *    비행이 다시 시작됐다는 뜻이다 — 실측 2026-09-17: 고치기 전 2회, 고친 뒤 1회.
 */
const MAX_FLIPS = 1
/** 이보다 작은 이동은 방향 판정에서 무시한다(px). 정착 후 미세 진동 오탐 방지. */
const NOISE = 0.5

/**
 * 매 프레임 마커 x 를 기록하기 시작한다.
 *
 * 🔴 **앞서 돌던 루프를 반드시 멈춘다.** 이 프로브는 경로마다 `track` 을 다시
 *    부르는데, 옛 루프를 세워 두지 않으면 rAF 콜백이 **겹쳐서 누적**된다.
 *    루프 N 개가 같은 배열에 push 하면 한 프레임에 샘플이 N 개 들어가고 순서가
 *    섞여 **없는 방향 반전이 만들어진다** — 실측 2026-09-17: 단독 측정 3회가
 *    이 프로브 안에서는 53회로 나왔다. 증상이 아니라 계측기가 틀린 것이었다.
 *    (CLAUDE.md: 프로브 판정의 위양성 — 새 검사기의 첫 판정은 대개 틀린다.)
 */
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

/**
 * 기록을 읽어 (정착 시간, 방향 반전 수) 를 낸다.
 * @returns {{settle: number, flips: number, frames: number} | null}
 */
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

  /*
   * 🔴 **정착 전 구간만 센다.** 정착한 뒤에도 마커는 소수점 단위로 흔들리는데
   *    (투영 반올림), 그걸 세면 노이즈가 압도한다 — 실측 2026-09-17: 전체를
   *    세면 53회, 정착 전만 세면 2회. 판정하려는 것은 "비행 중 경로가
   *    지그재그인가" 이지 "정착 후 떨리는가" 가 아니다.
   */
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

/** 링크를 눌러 이동한다 — `goto` 가 아니라 방문자가 하는 그대로. */
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

  // ── 1) 첫 진입 — 연출이므로 길어도 된다. 기준선으로만 찍는다.
  await pg.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await track(pg)
  await pg.waitForTimeout(5000)
  const first = await measure(pg)
  console.log(`  - 첫 진입 비행 ${first ? first.settle : '?'}ms (연출이므로 길어도 된다)`)

  // ── 2) 목록 → 홈, **로고 클릭**(클라이언트 내비게이션)
  await clickNav(pg, 'nav a[href="/work"]')
  await pg.waitForTimeout(2500)
  await clickNav(pg, 'nav a[href="/"]')
  await track(pg)
  await pg.waitForTimeout(5000)
  await check('목록 → 로고 → 홈', RETURN_BUDGET)

  // ── 3) 상세 → 홈, **로고 클릭** — #88 이 난 자리
  await clickNav(pg, 'nav a[href="/work"]')
  await pg.waitForTimeout(2000)
  await clickNav(pg, 'a[href^="/work/"]')
  await pg.waitForTimeout(3000)
  await clickNav(pg, 'nav a[href="/"]')
  await track(pg)
  await pg.waitForTimeout(5000)
  await check('상세 → 로고 → 홈', RETURN_BUDGET)

  // ── 4) 상세로 **직접 진입**한 뒤 복귀.
  //    🔴 검색·공유 링크가 곧 수주 경로라 이쪽이 오히려 기본 경로다(AGENTS.md).
  //    같은 탭을 쓰면 `sessionStorage` 의 intro-seen 이 남아 조건이 달라지므로
  //    **새 컨텍스트**에서 연다.
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const pg2 = await ctx2.newPage()
  await pg2.goto(`${BASE}/work/claude-board`, { waitUntil: 'networkidle' })
  await pg2.waitForTimeout(3000)
  await clickNav(pg2, 'nav a[href="/"]')
  await track(pg2)
  await pg2.waitForTimeout(6000)
  {
    const m = await measure(pg2)
    // 이 경로는 방을 처음 보는 것이라 입장 연출이 도는 것이 맞다. 다만
    // **복귀분까지 4.2초 전체를 다시 도는 것**은 아니어야 한다.
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
