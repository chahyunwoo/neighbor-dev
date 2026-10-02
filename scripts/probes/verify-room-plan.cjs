// 3D 를 안 띄우는 화면에서 2D 평면 방이 보이고, 핀이 목록과 같은 7개이며 잘리거나 겹치지 않는가. 3D 화면에선 안 보여야 한다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

const FLAT = [
  [390, 844],
  [430, 932],
  [768, 1024],
  [880, 900],
]
const WIDE = [1440, 900]
/** 탭 타깃이 겹치지 않는 최소 중심 간격(px). */
const MIN_GAP = 24

// 조상까지 올라가며 감춤(clip-path·1px·display·visibility·opacity)을 찾는다 — 요소만 보면 접힌 것을 보인다고 센다
function inspect() {
  const hidden = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n)
      const r = n.getBoundingClientRect()
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return true
      if (s.clipPath && s.clipPath !== 'none') return true
      if (r.width <= 1 || r.height <= 1) return true
    }
    return false
  }
  const pins = [...document.querySelectorAll('[data-plan-pin]')]
  const svg = pins[0]?.parentElement?.querySelector('svg') ?? null
  const box = svg?.getBoundingClientRect()
  const listNos = [
    ...document.querySelectorAll('[class*="RoomList-module"] a [aria-hidden="true"]'),
  ]
    .map((n) => n.textContent.trim())
    .filter((t) => /^\d+$/.test(t))
  const centers = pins.map((p) => {
    const r = p.getBoundingClientRect()
    return {
      no: p.dataset.planPin,
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      hidden: hidden(p),
    }
  })
  let minGap = Infinity
  for (let i = 0; i < centers.length; i++)
    for (let j = i + 1; j < centers.length; j++)
      minGap = Math.min(
        minGap,
        Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y),
      )
  const outside = box
    ? centers
        .filter((c) => c.x < box.left || c.x > box.right || c.y < box.top || c.y > box.bottom)
        .map((c) => c.no)
    : []
  return {
    svg: Boolean(svg),
    svgHidden: svg ? hidden(svg) : true,
    w: box ? Math.round(box.width) : 0,
    h: box ? Math.round(box.height) : 0,
    pinNos: centers.map((c) => c.no).sort(),
    hiddenPins: centers.filter((c) => c.hidden).map((c) => c.no),
    listNos: listNos.sort(),
    minGap,
    outside,
    vw: window.innerWidth,
    overX: centers.filter((c) => c.x < 0 || c.x > window.innerWidth).map((c) => c.no),
  }
}

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  const check = (ok, msg) => {
    if (!ok) fail++
    console.log(`  ${ok ? '✓' : '✗'} ${msg}`)
  }

  for (const [w, h] of FLAT) {
    const ctx = await b.newContext({
      viewport: { width: w, height: h },
      isMobile: w < 800,
      hasTouch: w < 800,
    })
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await pg.waitForTimeout(1500)
    const r = await pg.evaluate(inspect)
    const tag = `${String(w).padStart(4)}x${h}`
    check(r.svg && !r.svgHidden && r.w > 0 && r.h > 0, `${tag} 평면 방 보임 ${r.w}x${r.h}`)
    check(
      r.pinNos.length === 7 &&
        r.hiddenPins.length === 0 &&
        JSON.stringify(r.pinNos) === JSON.stringify(r.listNos),
      `${tag} 핀 ${r.pinNos.join('')} · 목록 ${r.listNos.join('')} · 감춰진 핀 ${r.hiddenPins.length}`,
    )
    check(
      r.outside.length === 0 && r.overX.length === 0,
      `${tag} 핀 중심이 평면 방·화면 안 (밖: ${[...r.outside, ...r.overX].join(',') || '없음'})`,
    )
    check(r.minGap >= MIN_GAP, `${tag} 핀 최소 간격 ${r.minGap.toFixed(1)}px (기준 ${MIN_GAP})`)
    await ctx.close()
  }

  {
    const ctx = await b.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const href = await pg.getAttribute('[data-plan-pin="7"]', 'href')
    await pg.tap('[data-plan-pin="7"]')
    const moved = await pg
      .waitForURL((u) => u.pathname === href, { timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    check(moved, `390 핀 7 탭 → ${href} (지금 ${new URL(pg.url()).pathname})`)
    await ctx.close()
  }

  {
    const ctx = await b.newContext({ viewport: { width: WIDE[0], height: WIDE[1] } })
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await pg.waitForSelector('[data-mode="3d"]', { timeout: 15000 }).catch(() => {})
    const r = await pg.evaluate(inspect)
    const mode = await pg.getAttribute('[data-mode]', 'data-mode')
    check(mode === '3d' && r.svgHidden, `${WIDE.join('x')} 3D(${mode}) 경로에서 평면 방 감춤`)
    await ctx.close()
  }

  await b.close()
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
