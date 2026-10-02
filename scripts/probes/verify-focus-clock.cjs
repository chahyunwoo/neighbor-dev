// 라우트 없이 프레임만 바뀐 직후 마커를 누르면 초점 비행이 그 프레임 시계를 받아 중간 진행도에서 출발하는가.
// 프레임 변경은 `--cv-top` 을 직접 바꿔 만든다 — `--foot-h` 는 클릭 때 CanvasShell 이 다시 재어 시계가 새로 생긴다.
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

// 프레임 변경 뒤 클릭까지(ms). 프레임 트윈(440ms) 진행 중이어야 한다.
const DELAY = 250
// 클릭 직후 프레임당 이동의 최대 증가(px). 정상 2.1~3.7, 묵은 시계를 받으면 35~37.
const MAX_STEP = 10
// 클릭 비행이 실제로 일어났다고 볼 최소 이동(px) — 없으면 0 이 통과로 읽힌다.
const MIN_TRAVEL = 100
const RUNS = 3

const run = async (b) => {
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await pg.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await pg.waitForFunction(() => document.querySelector('.room-marker-wrap button'))
  await pg.waitForTimeout(6000) // 입장 연출이 끝나야 초점 비행이 돈다
  await pg.evaluate(() => {
    window.__c = []
    const t = () => {
      const bs = document.querySelectorAll('.room-marker-wrap button')
      const r = bs[bs.length - 1]?.getBoundingClientRect()
      if (r) window.__c.push({ x: r.x, y: r.y, click: window.__clicked === true })
      requestAnimationFrame(t)
    }
    requestAnimationFrame(t)
  })
  await pg.waitForTimeout(300)
  const tweening = await pg.evaluate(async (delay) => {
    const shell = document.querySelector('.canvas-shell')
    const y0 = shell.style.getPropertyValue('--cf-y')
    document.documentElement.style.setProperty('--cv-top', '217px')
    await new Promise((r) => setTimeout(r, delay))
    const y1 = shell.style.getPropertyValue('--cf-y')
    document.querySelector('.room-marker-wrap button').click()
    window.__clicked = true
    return y0 !== y1 && y1 !== '217px'
  }, DELAY)
  await pg.waitForTimeout(1500)
  const c = await pg.evaluate(() => window.__c)
  await pg.close()

  const ci = c.findIndex((s) => s.click)
  const d = (i) => Math.hypot(c[i].x - c[i - 1].x, c[i].y - c[i - 1].y)
  let step = 0
  for (let i = ci + 2; ci > 0 && i <= Math.min(c.length - 1, ci + 8); i++)
    step = Math.max(step, d(i) - d(i - 1))
  const travel = ci > 0 ? Math.hypot(c.at(-1).x - c[ci].x, c.at(-1).y - c[ci].y) : 0
  return { tweening, step, travel }
}

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  for (let k = 0; k < RUNS; k++) {
    const m = await run(b)
    const ok = m.tweening && m.travel >= MIN_TRAVEL && m.step <= MAX_STEP
    if (!ok) fail++
    console.log(
      `  ${ok ? '✓' : '✗'} 프레임 변경 ${DELAY}ms 뒤 클릭 — 급변 ${m.step.toFixed(1)}px (허용 ${MAX_STEP}) · 비행 ${m.travel.toFixed(0)}px · 클릭 때 프레임 트윈 ${m.tweening ? '진행 중' : '아님(무효)'}`,
    )
  }
  await b.close()
  console.log(fail ? `\n${fail}/${RUNS} 실패` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
