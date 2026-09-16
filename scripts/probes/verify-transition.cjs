/**
 * #35 — 화면 전환이 **두 화면을 겹쳐** 넘어가는가.
 *
 * 🔴 **겹침이 요점이다.** 나가는 연출을 다 재생하고 라우트를 바꾸는 "순차"
 *    방식으로는 아무리 곡선을 다듬어도 "끊고 다시 시작" 으로 보인다
 *    (사용자 지적: "빨리빨리 넘어가고 뚜둑뚜둑 끊긴다"). View Transitions 가
 *    이전 화면을 스냅샷으로 잡아 새 화면과 GPU 에서 합성한다.
 *
 * 🔴 **headed 로 연다.** headless 크로뮴은 GPU 가 없어 12fps 로 떨어지고,
 *    그 상태로 모션을 재면 없는 증상이 만들어진다(이슈 #14).
 *
 * 무엇을 보는가:
 *   ① `startViewTransition` 이 실제로 불린다
 *   ② VT 의사요소 애니메이션이 붙는다 (CSS 가 먹었는가)
 *   ③ 전환 중 **두 화면의 글자가 같이 보인다** — 겹침의 직접 증거
 *   ④ 긴 프레임이 없다 (씬이 재마운트되면 90ms 대 멈춤이 난다)
 *   ⑤ 3D 캔버스가 살아남는다 (라우트를 넘어 하나)
 */
const { chromium } = require('./_pw.cjs')

const BASE = process.env.WEB_BASE_URL || 'http://localhost:3200'

async function main() {
  const browser = await chromium.launch({ headless: false, args: ['--window-position=-3000,0'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const problems = []
  const note = (s) => process.stdout.write(`${s}\n`)
  const calls = []
  await page.exposeFunction('__vt', (m) => calls.push(m))

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => {
    const orig = document.startViewTransition?.bind(document)
    if (!orig) return
    document.startViewTransition = (cb) => {
      window.__vt('called')
      return orig(cb)
    }
  })
  // 홈은 입장 연출이 끝난 뒤에 눌러야 한다.
  await page.waitForTimeout(4200)

  // 전환 중 상태를 매 프레임 기록한다.
  await page.evaluate(() => {
    window.__r = { f: [], last: performance.now(), t0: performance.now() }
    const tick = () => {
      const now = performance.now()
      window.__r.f.push({
        t: Math.round(now - window.__r.t0),
        gap: Math.round(now - window.__r.last),
        path: location.pathname,
        canvases: document.querySelectorAll('canvas').length,
        vt: document
          .getAnimations()
          .filter((a) => String(a.effect?.pseudoElement || '').includes('view-transition')).length,
      })
      window.__r.last = now
      window.__r.raf = requestAnimationFrame(tick)
    }
    tick()
  })

  await page.click('a[href="/work"]')
  await page.waitForTimeout(2200)
  const frames = await page.evaluate(() => {
    cancelAnimationFrame(window.__r.raf)
    return window.__r.f
  })

  // ① VT 호출
  note(`startViewTransition 호출: ${calls.length}회`)
  if (calls.length === 0) {
    problems.push('startViewTransition 이 안 불렸다 — 전환이 그냥 라우팅으로 끝난다')
  }

  // ② 의사요소 애니메이션 (CSS 가 먹었는가)
  const maxVt = Math.max(0, ...frames.map((f) => f.vt))
  note(`VT 의사요소 애니메이션(최대 동시): ${maxVt}개`)
  if (maxVt === 0) problems.push('VT 애니메이션이 하나도 안 붙었다 — tokens.css 의 규칙을 확인한다')

  // ③ 겹치는 구간이 실제로 있었는가
  const overlap = frames.filter((f) => f.vt > 0).length
  const span = frames.filter((f) => f.vt > 0)
  const dur = span.length ? (span.at(-1)?.t ?? 0) - (span[0]?.t ?? 0) : 0
  note(`겹친 프레임: ${overlap}개 · ${dur}ms (${span[0]?.t ?? '-'} ~ ${span.at(-1)?.t ?? '-'})`)
  /*
   * ⚠️ 프레임 **수**가 아니라 **지속 시간**으로 본다. 우리 CSS 를 죽여도
   *    브라우저 기본 크로스페이드(250ms)만으로 16프레임은 나온다(실측).
   *    우리 규칙은 640ms 짜리다.
   */
  if (dur < 420) {
    problems.push(`겹친 구간이 ${dur}ms 뿐이다 — 기본값만 돌고 우리 곡선이 안 먹었을 수 있다`)
  }

  // ④ 긴 프레임 — 씬이 재마운트되면 여기서 드러난다
  const gaps = frames.slice(1).map((f) => f.gap)
  const over50 = gaps.filter((g) => g > 50).length
  const over100 = gaps.filter((g) => g > 100).length
  note(`프레임 간격: 최악 ${Math.max(...gaps)}ms · 50ms 초과 ${over50}개 · 100ms 초과 ${over100}개`)
  if (over100 > 0) {
    problems.push(`100ms 넘는 멈춤이 ${over100}개 — 씬이 라우트마다 재마운트되면 이렇게 된다`)
  }

  // ⑤ 캔버스는 하나로 살아남는가
  const canvases = [...new Set(frames.map((f) => f.canvases))]
  note(`캔버스 수(전환 내내): ${canvases.join(', ')}`)
  if (canvases.some((c) => c !== 1)) {
    problems.push(`캔버스 수가 ${canvases.join('→')} 로 변했다 — 지속 캔버스가 깨졌다`)
  }

  // 도착 확인
  const moved = frames.some((f) => f.path === '/work')
  if (!moved) problems.push('경로가 안 바뀌었다')

  await browser.close()

  if (problems.length) {
    process.stderr.write(`\n🔴 전환 ${problems.length}건 문제\n`)
    for (const p of problems) process.stderr.write(`  · ${p}\n`)
    process.exit(1)
  }
  note('\n✅ 전환 — 겹침·CSS·프레임·지속 캔버스 전부 확인')
}

main().catch((e) => {
  process.stderr.write(`${e.stack}\n`)
  process.exit(1)
})
