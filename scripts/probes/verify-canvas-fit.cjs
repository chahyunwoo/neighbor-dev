// 라우트가 바뀌어도 캔버스가 헤더·푸터에 맞춰 다시 앉는가(지속 캔버스라 CanvasShell 이 DOM 변화를 보고 다시 잰다).
// 요점은 홈으로 돌아오는 방향 — 푸터가 다시 생기는 것은 ResizeObserver 가 알려 주지 않는다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

const READ = () => {
  const cs = getComputedStyle(document.documentElement)
  const foot = document.querySelector('footer')
  const nav = document.querySelector('nav')
  // 3D 가 보이는 영역은 캔버스(뷰포트 전체)가 아니라 .canvas-frame 이다
  const c = document.querySelector('.canvas-frame')?.getBoundingClientRect()
  // 3D 를 실제로 자르는 것은 껍데기의 clip-path — .canvas-frame 과 어긋나면 3D 가 본문·푸터 뒤로 샌다
  const shell = document.querySelector('.canvas-shell')
  let clipGap = null
  if (c && shell) {
    const m = /inset\(([^)]*)\)/.exec(getComputedStyle(shell).clipPath)
    const v = m
      ? m[1]
          .trim()
          .split(/\s+/)
          .map((x) => Number.parseFloat(x) || 0)
      : []
    const [t = 0, r = t, bt = t, l = r] = v
    const box = shell.getBoundingClientRect()
    const clip = { x: box.x + l, y: box.y + t, right: box.right - r, bottom: box.bottom - bt }
    clipGap = Math.max(
      Math.abs(clip.x - c.x),
      Math.abs(clip.y - c.y),
      Math.abs(clip.right - c.right),
      Math.abs(clip.bottom - c.bottom),
    )
  }
  return {
    clipGap,
    varFoot: cs.getPropertyValue('--foot-h').trim(),
    varNav: cs.getPropertyValue('--nav-h').trim(),
    realFoot: foot ? Math.round(foot.getBoundingClientRect().height) : 0,
    realNav: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
    canvas: c ? `${Math.round(c.width)}x${Math.round(c.height)}` : '-',
  }
}

;(async () => {
  const b = await chromium.launch(LAUNCH)
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await pg.goto(`${BASE}/`, { waitUntil: 'load' })
  await pg.waitForTimeout(6000)

  let fail = 0
  const step = async (label) => {
    const r = await pg.evaluate(READ)
    const ok =
      r.varFoot === `${r.realFoot}px` &&
      r.varNav === `${r.realNav}px` &&
      r.clipGap !== null &&
      r.clipGap <= 1
    if (!ok) fail++
    console.log(
      `  ${ok ? '✓' : '✗'} ${label.padEnd(12)} --foot-h=${r.varFoot}(실제 ${r.realFoot}px) · --nav-h=${r.varNav}(실제 ${r.realNav}px) · 영역 ${r.canvas} · 잘라내기 차이 ${r.clipGap === null ? '측정 불가' : `${Math.round(r.clipGap)}px`}`,
    )
  }
  await step('홈')
  await pg.$eval('a[href="/work"]', (e) => e.click())
  await pg.waitForURL('**/work')
  await pg.waitForTimeout(2500)
  await step('→ /work')
  await pg.$eval('a[href="/"]', (e) => e.click())
  await pg.waitForURL((u) => new URL(u).pathname === '/')
  await pg.waitForTimeout(2500)
  await step('→ 홈 복귀')

  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n캔버스가 헤더·푸터를 따라 다시 앉는다')
  process.exit(fail ? 1 : 0)
})()
