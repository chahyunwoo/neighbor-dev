/**
 * 라우트가 바뀌어도 캔버스가 **헤더·푸터에 맞춰 다시 앉는가.**
 *
 * 🔴 캔버스는 라우트를 넘어 살아 있다(지속 캔버스). 그래서 화면이 바뀌어도
 *    이 컴포넌트의 effect 가 다시 돌지 않는다 — 대신 `CanvasShell` 이
 *    body 의 DOM 변화를 보고 `--nav-h`·`--foot-h` 를 다시 잰다.
 *
 * 🔴 **`/work` 로 나가는 방향은 이 검사 없이도 우연히 맞는다.** 푸터가
 *    사라질 때는 ResizeObserver 가 0x0 으로 한 번 쏘아 주기 때문이다.
 *    문제는 **돌아오는 방향**이다 — 없던 푸터가 다시 생기면 그것을 보고
 *    있는 것이 아무것도 없다.
 *
 *    실측 2026-09-17(관찰을 꺼서 확인): 홈 복귀 시 `--foot-h` 가 `0px` 로
 *    남고 캔버스가 733 → **803** 이 되어 **3D 가 푸터를 70px 덮었다.**
 */
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

const READ = () => {
  const cs = getComputedStyle(document.documentElement)
  const foot = document.querySelector('footer')
  const nav = document.querySelector('nav')
  const c = document.querySelector('canvas')?.getBoundingClientRect()
  return {
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
    const ok = r.varFoot === `${r.realFoot}px` && r.varNav === `${r.realNav}px`
    if (!ok) fail++
    console.log(
      `  ${ok ? '✓' : '✗'} ${label.padEnd(12)} --foot-h=${r.varFoot}(실제 ${r.realFoot}px) · --nav-h=${r.varNav}(실제 ${r.realNav}px) · 캔버스 ${r.canvas}`,
    )
  }
  await step('홈')
  await pg.$eval('a[href="/work"]', (e) => e.click())
  await pg.waitForURL('**/work')
  await pg.waitForTimeout(2500)
  await step('→ /work')
  // 🔴 돌아오는 방향이 요점이다.
  await pg.$eval('a[href="/"]', (e) => e.click())
  await pg.waitForURL((u) => new URL(u).pathname === '/')
  await pg.waitForTimeout(2500)
  await step('→ 홈 복귀')

  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n캔버스가 헤더·푸터를 따라 다시 앉는다')
  process.exit(fail ? 1 : 0)
})()
