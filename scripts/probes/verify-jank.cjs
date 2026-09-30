// 3D 모션 중 프레임이 튀는가 — 평균 fps 가 아니라 긴 프레임의 수와 시점을 센다. 레티나(DSF 2)로 연다(DSF 1 은 dpr 비용이 빠진다).
// 돌리는 법: node scripts/probes/verify-jank.cjs [--dsf 1]
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

const DSF = Number(process.argv[process.argv.indexOf('--dsf') + 1]) || 2
// 허용하는 33ms 초과 프레임 수 — 60Hz 에서 두 프레임을 연달아 놓친 것
const MAX_LONG = 2
const ALL = ['모니터', '화이트보드', '책장', '서랍', '노트북', '테이블', '현관문']
// --first <이름>: 처음 열 물건을 바꿔 튐이 물건을 따라가는지 '처음' 을 따라가는지 가른다
const FIRST = process.argv.includes('--first')
  ? process.argv[process.argv.indexOf('--first') + 1]
  : ALL[0]
const NAMES = [FIRST, ...ALL.filter((n) => n !== FIRST)]

;(async () => {
  const b = await chromium.launch(LAUNCH)
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DSF })
  const pg = await ctx.newPage()

  await pg.addInitScript(() => {
    window.__phase = 'load'
    window.__f = []
    let last = 0
    const tick = (t) => {
      if (last) window.__f.push([window.__phase, t - last])
      last = t
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  await pg.goto(`${BASE}/`, { waitUntil: 'load' })
  await pg.evaluate(() => {
    window.__phase = 'intro'
  })
  await pg.waitForTimeout(4500)

  for (const name of NAMES) {
    await pg.evaluate((n) => {
      window.__phase = n
    }, name)
    await pg.getByLabel(new RegExp(`^${name} —`)).click({ force: true })
    await pg.waitForTimeout(1800)
  }
  await pg.evaluate(() => {
    window.__phase = '닫기'
  })
  await pg.keyboard.press('Escape')
  await pg.waitForTimeout(1800)

  const info = await pg.evaluate(() => {
    const c = document.querySelector('canvas')
    const gl = c?.getContext('webgl2')
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      canvas: c ? `${c.width}x${c.height} (css ${c.clientWidth}x${c.clientHeight})` : '-',
      gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '-',
    }
  })
  const frames = await pg.evaluate(() => window.__f)
  await b.close()

  console.log(`DSF ${DSF} · 캔버스 ${info.canvas} · ${info.gpu}`)
  const phases = [...new Set(frames.map(([p]) => p))]
  let fail = 0
  for (const p of phases) {
    const d = frames.filter(([q]) => q === p).map(([, ms]) => ms)
    const sorted = [...d].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
    const over20 = d.filter((ms) => ms > 20).length
    const over33 = d.filter((ms) => ms > 33).length
    const max = sorted.at(-1) ?? 0
    const ok = p === 'load' || over33 <= MAX_LONG
    if (!ok) fail++
    console.log(
      `  ${ok ? '✓' : '✗'} ${p.padEnd(6)} ${String(d.length).padStart(4)}프레임 · p95 ${p95.toFixed(1)}ms · >20ms ${over20} · >33ms ${over33} · 최대 ${max.toFixed(0)}ms`,
    )
  }
  console.log(fail ? `\n${fail}구간 실패 (구간당 >33ms 허용 ${MAX_LONG})` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
