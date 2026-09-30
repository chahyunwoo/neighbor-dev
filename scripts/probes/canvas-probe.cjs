// 지속 캔버스 전환 프로브 — DOM 겹침·이벤트처럼 정적 검사기가 못 보는 것. 마커는 실제 마우스 좌표로 누른다(.click() 은 덮인 요소도 눌러 버린다).
// 쓰는 법: PORT=21200 pnpm --filter @neighbor/web start 로 띄운 뒤 node scripts/probes/canvas-probe.cjs

const NAMES = ['모니터', '화이트보드', '책장', '서랍', '노트북', '테이블', '현관문']
// 시간이 아니라 입장 완료 플래그로 기다린다 — 비행 중에 재면 마커 좌표가 (0,0) 으로 잡힌다
// 3D 가 없는 화면(모바일·reduced-motion·JS 비활성)에서는 플래그가 안 붙어 타임아웃을 삼킨다
async function waitEntered(pg, quiet = 900) {
  await pg
    .waitForFunction(() => document.documentElement.dataset.roomEntered === 'true', {
      timeout: 15000,
    })
    .catch(() => {})
  await pg.waitForTimeout(quiet)
}

const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

let fail = 0
const ok = (cond, label, detail) => {
  if (!cond) fail++
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`)
}

async function markerHits(page) {
  return page.evaluate((names) => {
    const out = []
    for (const n of names) {
      const b = [...document.querySelectorAll('button[class*="marker"][aria-label]')].find((x) =>
        (x.getAttribute('aria-label') || '').startsWith(n),
      )
      if (!b) {
        out.push({ name: n, found: false })
        continue
      }
      const r = b.getBoundingClientRect()
      const cx = Math.round(r.x + r.width / 2)
      const cy = Math.round(r.y + r.height / 2)
      const top = document.elementFromPoint(cx, cy)
      out.push({
        name: n,
        found: true,
        pt: [cx, cy],
        // 마커 자신(또는 자손)이 잡혀야 실제로 눌린다
        reachable: !!top && (b === top || b.contains(top)),
        blocker: top
          ? top.tagName +
            '.' +
            String(top.className || '')
              .split(' ')[0]
              .slice(0, 30)
          : 'null',
      })
    }
    return out
  }, NAMES)
}

;(async () => {
  const browser = await chromium.launch(LAUNCH)

  console.log('\n[1] 데스크톱 1440x900')
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const lost = []
  page.on('console', (m) => {
    if (/webglcontextlost|context lost/i.test(m.text())) lost.push(m.text())
  })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await waitEntered(page)

  const n1 = await page.evaluate(() => document.querySelectorAll('canvas').length)
  ok(n1 === 1, `캔버스 1개`, `실제 ${n1}`)

  // 캔버스가 transform 조상 안에 있으면 라우트 전환 중 흔들린다
  const parents = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (!c) return null
    const chain = []
    let el = c.parentElement
    while (el && el !== document.body) {
      chain.push(getComputedStyle(el).transform !== 'none' ? 'TRANSFORMED' : 'ok')
      el = el.parentElement
    }
    return chain
  })
  ok(parents !== null && !parents.includes('TRANSFORMED'), 'transform 조상 없음', String(parents))

  const hits = await markerHits(page)
  const reach = hits.filter((h) => h.reachable).length
  ok(reach === NAMES.length, `마커 ${NAMES.length}개 도달 가능`, `${reach}/${NAMES.length}`)
  for (const h of hits.filter((x) => !x.reachable))
    console.log(`      덮임: ${h.name} ← ${h.blocker}`)

  // 마커마다 새 페이지를 연다 — 연속으로 누르면 카메라 이동으로 다른 마커가 움직여 클릭 실패로 오진한다
  let opened = 0
  // 마커로 한정해 집는다 — button[aria-label] 이면 clip-path 로 숨긴 번호 목록의 같은 라벨이 먼저 걸려 (0,0) 을 누른다
  for (const name of NAMES) {
    const fctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const fresh = await fctx.newPage()
    await fresh.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    // 입장이 끝나야 마커가 제자리에 선다 — 입장 중 카메라 뒤 마커는 drei Html 이 숨겨 (0,0) 이 된다
    await waitEntered(fresh)
    // 고정 대기로는 부족하다 — 마커가 실제로 DOM 에 나타날 때까지 기다린다
    await fresh
      .waitForFunction(
        (n) =>
          [...document.querySelectorAll('button[class*="marker"][aria-label]')].some((x) =>
            (x.getAttribute('aria-label') || '').startsWith(n),
          ),
        name,
        { timeout: 15000 },
      )
      .catch(() => {})
    // 보이는 것과 제자리에 선 것은 다르다 — 좌표가 두 번 연속 같아질 때까지 기다린다
    await fresh
      .waitForFunction(
        (n) => {
          const b = [...document.querySelectorAll('button[class*="marker"][aria-label]')].find(
            (x) => (x.getAttribute('aria-label') || '').startsWith(n),
          )
          if (!b) return false
          const q = b.getBoundingClientRect()
          // (0,0)·크기 0 은 아직 안 그려진 것이지 제자리가 아니다
          if (q.width === 0 || q.height === 0 || (q.x === 0 && q.y === 0)) return false
          const now = `${Math.round(q.x)},${Math.round(q.y)}`
          const w = window
          const same = w.__last === now
          w.__last = now
          return same
        },
        name,
        { timeout: 20000, polling: 400 },
      )
      .catch(() => {})
    const pt = await fresh.evaluate((n) => {
      const b = [...document.querySelectorAll('button[class*="marker"][aria-label]')].find((x) =>
        (x.getAttribute('aria-label') || '').startsWith(n),
      )
      if (!b) return null
      const q = b.getBoundingClientRect()
      return [Math.round(q.x + q.width / 2), Math.round(q.y + q.height / 2)]
    }, name)
    if (pt) {
      await fresh.mouse.click(pt[0], pt[1])
      await fresh.waitForTimeout(900)
      const isOpen = await fresh.evaluate((n) => {
        const b = [...document.querySelectorAll('button[class*="marker"][aria-label]')].find((x) =>
          (x.getAttribute('aria-label') || '').startsWith(n),
        )
        return b ? b.getAttribute('aria-expanded') === 'true' : false
      }, name)
      if (isOpen) opened++
      else console.log(`      클릭 실패: ${name} (${pt.join(',')})`)
    } else {
      console.log(`      마커 없음: ${name}`)
    }
    await fctx.close()
  }
  ok(opened === NAMES.length, `마커 클릭 → 열림 ${NAMES.length}개`, `${opened}/${NAMES.length}`)

  console.log('\n[2] 라우트 이동 후 캔버스 생존')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await waitEntered(page)
  await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (c) c.dataset.probe = 'p1'
  })
  // 클라이언트 내비게이션이어야 한다 — goto 는 새로고침이라 의미가 없다
  await page.click('a[href="/work"]')
  await page.waitForTimeout(2000)
  const survived = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    return { path: location.pathname, probe: c ? c.dataset.probe || null : 'canvas 없음' }
  })
  ok(
    survived.probe === 'p1',
    '표식 유지(캔버스가 살아있다)',
    `${survived.path} → ${survived.probe}`,
  )

  await page.click('a[href="/"]')
  await waitEntered(page)
  const back = await markerHits(page)
  const backReach = back.filter((h) => h.reachable).length
  ok(backReach === NAMES.length, '홈 복귀 후 마커 도달', `${backReach}/${NAMES.length}`)
  ok(lost.length === 0, 'WebGL 컨텍스트 손실 0건', `${lost.length}건`)
  await ctx.close()

  // 페이지 모드에서 캔버스는 클릭을 안 받아야 한다 — R3F 가 래퍼에 pointer-events:auto 를 인라인으로 박아 CSS 로 못 이긴다
  // clip-path 로 감춘 접근성 폴백(RoomList)은 의도된 설계라 세지 않는다
  console.log('\n[2-B] 본문 상호작용 요소')
  for (const path of ['/', '/work', '/work/claude-board', '/team', '/contact']) {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await c.newPage()
    await pg.goto(BASE + path, { waitUntil: 'networkidle' })
    if (path === '/') await waitEntered(pg)
    else await pg.waitForTimeout(1500)
    const dead = await pg.evaluate(() => {
      const out = []
      for (const el of document.querySelectorAll('a,button,input,textarea,select,summary')) {
        const q = el.getBoundingClientRect()
        if (q.width === 0 || q.height === 0) continue
        if (q.y < 0 || q.y > window.innerHeight) continue
        if (getComputedStyle(el).visibility === 'hidden') continue
        if ((el.getAttribute('aria-label') || '').includes('\u2014')) continue
        let clipped = false
        for (let a = el; a && a !== document.body; a = a.parentElement) {
          const cp = getComputedStyle(a).clipPath
          if (cp && cp !== 'none') {
            clipped = true
            break
          }
        }
        if (clipped) continue
        // 중심이 아니라 화면 안에 있는 지점을 찍는다 — 윗변만 걸친 큰 카드는 중심이 스크롤 아래라 오탐이 난다
        const py = Math.min(Math.max(q.y + q.height / 2, 2), window.innerHeight - 2)
        const top = document.elementFromPoint(Math.round(q.x + q.width / 2), Math.round(py))
        if (!top || !(el === top || el.contains(top) || top.contains(el))) {
          out.push(
            el.tagName +
              ' "' +
              (el.textContent || '').trim().slice(0, 16) +
              '" <- ' +
              (top ? top.tagName : 'null'),
          )
        }
      }
      return out
    })
    ok(dead.length === 0, path, dead.length ? dead.join(' / ') : '전부 눌린다')
    await c.close()
  }

  console.log('\n[3] 폴백 3단')
  const cases = [
    ['모바일 390', { viewport: { width: 390, height: 844 } }],
    ['reduced-motion', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }],
    ['JS 비활성', { viewport: { width: 1440, height: 900 }, javaScriptEnabled: false }],
  ]
  for (const [label, opts] of cases) {
    const c = await browser.newContext(opts)
    const p = await c.newPage()
    await p.goto(`${BASE}/`, { waitUntil: 'load' })
    if (opts.javaScriptEnabled === false) await p.waitForTimeout(400)
    else await waitEntered(p, 400)
    const r = await p.evaluate(() => ({
      canvas: document.querySelectorAll('canvas').length,
      links: document.querySelectorAll(
        'a[href^="/work"],a[href^="/stack"],a[href^="/career"],a[href^="/team"],a[href^="/diagnose"],a[href^="/contact"]',
      ).length,
    }))
    ok(r.canvas === 0 && r.links === 10, label, `캔버스 ${r.canvas} · 링크 ${r.links}`)
    await c.close()
  }

  // 크롤러가 받는 HTML 은 3D 와 독립이어야 한다
  console.log('\n[4] 서버 렌더 HTML')
  const html = await (await fetch(`${BASE}/`)).text()
  const canvasTags = (html.match(/<canvas/g) || []).length
  const present = NAMES.filter((n) => html.includes(n)).length
  ok(canvasTags === 0, '서버 HTML 에 <canvas> 0개', `${canvasTags}개`)
  ok(
    present === NAMES.length,
    `물건 ${NAMES.length}개 서버 HTML 등장`,
    `${present}/${NAMES.length}`,
  )

  await browser.close()
  console.log(fail === 0 ? '\n전부 통과' : `\n실패 ${fail}건`)
  process.exit(fail === 0 ? 0 : 1)
})()
