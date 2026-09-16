/**
 * #35 — 화면 전환 연출이 실제로 도는가.
 *
 * 🔴 **매 프레임으로 잰다.** 정지 스크린샷 몇 장과 200ms 샘플링으로 "정상" 이라
 *    판정해 왔는데 전부 틀렸다(CLAUDE.md). `requestAnimationFrame` 마다 기록한다.
 *
 * 🔴 **headed 로 연다.** headless 크로뮴은 GPU 가 없어 12fps 로 떨어지고,
 *    그 상태로 모션을 재면 **없는 증상이 만들어진다**(이슈 #14 에서 두 건 오진).
 *
 * 무엇을 보는가:
 *   ① 링크를 눌러도 **바로 이동하지 않는다** (연출 시간이 실재한다)
 *   ② 그 사이 `data-transition="exiting"` 이 붙는다
 *   ③ 제목 글자들이 **서로 다른 시각에** 움직인다 (낱개로 논다 — 한 덩어리가 아니다)
 *   ④ 3D 가 뒤로 물러난다 (`.canvas-shell` 의 transform 이 바뀐다)
 *   ⑤ 도착한 화면에서 상태가 풀린다 (흩어진 채로 남지 않는다)
 */
const { chromium } = require('./_pw.cjs')

const BASE = process.env.WEB_BASE_URL || 'http://localhost:3200'

/** 한 프레임마다 화면 상태를 찍는 기록기. 페이지 안에서 돈다. */
const RECORDER = `
window.__rec = { frames: [], t0: performance.now() }
const tick = () => {
  const el = document.documentElement
  const shell = document.querySelector('.canvas-shell')
  const glyphs = [...document.querySelectorAll('h1 span[aria-hidden] span')]
  window.__rec.frames.push({
    t: Math.round(performance.now() - window.__rec.t0),
    path: location.pathname,
    phase: el.getAttribute('data-transition') || 'none',
    shell: shell ? getComputedStyle(shell).transform : null,
    // 글자별 세로 위치 — 낱개로 움직이면 값이 서로 달라진다
    ys: glyphs.slice(0, 12).map((g) => Math.round(g.getBoundingClientRect().top * 10) / 10),
    op: glyphs.slice(0, 12).map((g) => Math.round(parseFloat(getComputedStyle(g).opacity) * 100)),
  })
  window.__rec.raf = requestAnimationFrame(tick)
}
tick()
`

async function main() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const problems = []
  const note = (s) => process.stdout.write(`${s}\n`)

  await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' })
  // 폰트가 준비돼야 글자가 쪼개진다(SplitText 는 그때까지 원문을 둔다).
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)

  const split = await page.evaluate(
    () => document.querySelectorAll('h1 span[aria-hidden] span').length,
  )
  note(`제목이 쪼개진 글자 수: ${split}`)
  if (split === 0) problems.push('제목이 낱글자로 쪼개지지 않았다 (SplitText 가 안 돈다)')

  const label = await page.evaluate(() => document.querySelector('h1')?.getAttribute('aria-label'))
  note(`h1 aria-label: ${JSON.stringify(label)}`)
  if (!label) problems.push('h1 에 aria-label 이 없다 — 스크린리더가 글자를 하나씩 읽는다')

  // ── 전환을 기록한다 ────────────────────────────────────────────
  await page.evaluate(RECORDER)
  const before = page.url()
  await page.click('a[href^="/work/"]')
  await page.waitForTimeout(1600)

  const frames = await page.evaluate(() => {
    cancelAnimationFrame(window.__rec.raf)
    return window.__rec.frames
  })
  note(`기록한 프레임: ${frames.length}`)
  if (frames.length < 30) {
    problems.push(`프레임이 ${frames.length}개뿐이다 — 측정 자체가 못 미덥다`)
  }

  // ① 즉시 이동하지 않았는가
  const moved = frames.find((f) => f.path !== new URL(before).pathname)
  note(`경로가 바뀐 시각: ${moved ? `${moved.t}ms` : '안 바뀜'}`)
  if (!moved) problems.push('경로가 아예 안 바뀌었다')
  else if (moved.t < 250) problems.push(`${moved.t}ms 만에 이동했다 — 연출이 재생될 시간이 없다`)

  // ② exiting 이 붙었는가
  const exiting = frames.filter((f) => f.phase === 'exiting')
  note(
    `exiting 프레임: ${exiting.length}개 (${exiting[0]?.t ?? '-'}ms ~ ${exiting.at(-1)?.t ?? '-'}ms)`,
  )
  if (exiting.length === 0) problems.push('data-transition="exiting" 이 한 번도 안 붙었다')

  // ③ 글자가 낱개로 노는가 — 같은 프레임에서 세로 위치가 갈리는 순간이 있어야 한다
  let spread = 0
  for (const f of frames) {
    if (f.ys.length < 3) continue
    const d = Math.max(...f.ys) - Math.min(...f.ys)
    if (d > spread) spread = d
  }
  note(`같은 프레임 안 글자 높이 차이(최대): ${spread}px`)
  if (spread < 3) {
    problems.push(`글자들이 ${spread}px 차이로만 움직였다 — 한 덩어리로 움직인다(판때기 슬라이드)`)
  }

  // ④ 3D 가 물러났는가
  const shells = [...new Set(frames.map((f) => f.shell).filter(Boolean))]
  note(`.canvas-shell transform 종류: ${shells.length}`)
  if (shells.length < 2) {
    problems.push(
      '전환 중 .canvas-shell 의 transform 이 한 번도 안 바뀌었다 — 3D 가 반응하지 않는다',
    )
  }

  // ⑤ 도착 후 상태가 풀렸는가
  const last = await page.evaluate(() => ({
    phase: document.documentElement.getAttribute('data-transition'),
    op: [...document.querySelectorAll('h1 span[aria-hidden] span')]
      .slice(0, 8)
      .map((g) => Math.round(parseFloat(getComputedStyle(g).opacity) * 100)),
  }))
  note(`도착 후 phase=${last.phase} 글자 불투명도=${JSON.stringify(last.op)}`)
  if (last.phase === 'exiting') problems.push('도착했는데 exiting 이 안 풀렸다')
  if (last.op.length && last.op.some((o) => o < 90)) {
    problems.push(`도착 화면의 글자가 흐리게 남았다 (${last.op.join(',')})`)
  }

  await browser.close()

  if (problems.length) {
    process.stderr.write(`\n🔴 전환 연출 ${problems.length}건 문제\n`)
    for (const p of problems) process.stderr.write(`  · ${p}\n`)
    process.exit(1)
  }
  note('\n✅ 전환 연출 — 지연·상태·낱글자·3D 반응·복구 전부 확인')
}

main().catch((e) => {
  process.stderr.write(`${e.stack}\n`)
  process.exit(1)
})
