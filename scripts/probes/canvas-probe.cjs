/**
 * 지속 캔버스 전환 프로브 — 검사기가 못 잡는 것만 본다.
 *
 * 🔴 이 프로젝트의 CLAUDE.md 가 못박은 실패 형태를 겨냥한다:
 *    "빌드는 통과하는데 클릭이 죽는다", "검사기 초록인데 화면이 틀렸다".
 *    `pnpm verify` 도 `verify-room.mjs` 도 DOM 겹침과 이벤트를 못 본다.
 *
 * ⚠️ 마커를 **실제 마우스 좌표로** 누른다. 프로그램적 `.click()` 은 덮인
 *    요소도 그냥 눌러버려 "덮여서 클릭이 안 되는" 상태를 못 잡는다
 *    (실측 2026-09-09: 화이트보드·테이블 마커가 정확히 그 상태였다).
 *
 * 쓰는 법: pnpm --filter @neighbor/web start 로 3200 을 띄운 뒤
 *     node .wip/canvas-probe.cjs
 */

const BASE = process.env.WEB_BASE_URL ?? 'http://localhost:3200'
const NAMES = ['모니터', '화이트보드', '책장', '서랍', '노트북', '테이블', '현관문']
/** 입장 연출 3.2초 + 여유. 이보다 일찍 재면 "연출이 안 돈다" 로 오진한다. */
const ENTER_MS = 4200

const { chromium } = require('./_pw.cjs')

let fail = 0
const ok = (cond, label, detail) => {
  if (!cond) fail++
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`)
}

async function markerHits(page) {
  return page.evaluate((names) => {
    const out = []
    for (const n of names) {
      const b = [...document.querySelectorAll('button[aria-label]')].find((x) =>
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
        // 마커 자신(또는 그 자손)이 잡혀야 실제로 눌린다
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
  const browser = await chromium.launch()

  // ── 1. 데스크톱: 캔버스 개수 · 마커 도달성 · 실제 클릭 ──────────────
  console.log('\n[1] 데스크톱 1440x900')
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const lost = []
  page.on('console', (m) => {
    if (/webglcontextlost|context lost/i.test(m.text())) lost.push(m.text())
  })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(ENTER_MS)

  const n1 = await page.evaluate(() => document.querySelectorAll('canvas').length)
  ok(n1 === 1, `캔버스 1개`, `실제 ${n1}`)

  // 캔버스가 template(transform) 안에 있으면 라우트 전환 중 흔들린다
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

  /*
   * 실제 마우스로 눌러 패널이 열리는가.
   *
   * ⚠️ **마커마다 새 페이지를 연다.** 한 페이지에서 연속으로 누르면
   *    첫 클릭에 카메라가 그 물건으로 날아가고, 그 구도에서 다른 마커가
   *    이동하거나 화면 밖으로 나간다 — 그걸 "클릭 실패" 로 읽으면 오진이다
   *    (실측 2026-09-09: 그렇게 6/7 실패로 잘못 읽었는데, 새 페이지로 재면
   *    7/7 이었다). 카메라 이동은 의도된 동작이지 버그가 아니다.
   */
  let opened = 0
  for (const name of NAMES) {
    const fctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const fresh = await fctx.newPage()
    await fresh.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    /*
     * ⚠️ 고정 대기로는 부족하다. GPU 가 붐비면 입장 연출이 늦게 끝나
     * 마커가 아직 DOM 에 없는데 **"마커 없음" 으로 오진한다**(실측).
     * 마커가 실제로 나타날 때까지 기다린 뒤 잰다.
     */
    await fresh
      .waitForFunction(
        (n) =>
          [...document.querySelectorAll('button[aria-label]')].some((x) =>
            (x.getAttribute('aria-label') || '').startsWith(n),
          ),
        name,
        { timeout: 15000 },
      )
      .catch(() => {})
    /*
     * 🔴 마커가 **보이는 것**과 **제자리에 선 것**은 다르다. 입장 연출
     * 3.2초 동안 카메라가 나는데, 그 사이에 좌표를 재면 엉뚱한 자리를
     * 누른다(실측: 노트북 마커를 (330,414)에서 재어 카피 위를 눌렀다).
     * 좌표가 두 번 연속 같아질 때까지 기다린다.
     */
    await fresh
      .waitForFunction(
        (n) => {
          const b = [...document.querySelectorAll('button[aria-label]')].find((x) =>
            (x.getAttribute('aria-label') || '').startsWith(n),
          )
          if (!b) return false
          const q = b.getBoundingClientRect()
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
      const b = [...document.querySelectorAll('button[aria-label]')].find((x) =>
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
        const b = [...document.querySelectorAll('button[aria-label]')].find((x) =>
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

  // ── 2. 캔버스가 라우트를 넘어 사는가 (이 작업의 성공 조건) ───────────
  console.log('\n[2] 라우트 이동 후 캔버스 생존')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(ENTER_MS)
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

  // 홈 복귀 후에도 마커가 눌리는가
  await page.click('a[href="/"]')
  await page.waitForTimeout(ENTER_MS)
  const back = await markerHits(page)
  const backReach = back.filter((h) => h.reachable).length
  ok(backReach === NAMES.length, '홈 복귀 후 마커 도달', `${backReach}/${NAMES.length}`)
  ok(lost.length === 0, 'WebGL 컨텍스트 손실 0건', `${lost.length}건`)
  await ctx.close()

  // ── 2-B. 전 화면에서 본문 링크·버튼이 눌리는가 ───────────────────
  /*
   * 🔴 캔버스가 layout 으로 올라가면 본문 위를 덮는다. 페이지 모드에서는
   *    클릭을 안 받아야 하는데, R3F 가 자기 래퍼에 pointer-events:auto 를
   *    **인라인으로** 박아 CSS 규칙으로는 못 이긴다.
   *    실측 2026-09-09: /work 사례 카드 4개, /work/<id> 토글 2개,
   *    /team 링크 1개가 안 눌렸다. 빌드도 pnpm verify 도 초록이었다.
   *
   * ⚠️ clip-path 로 감춘 접근성 폴백(RoomList)은 세지 않는다 — 3D 가 뜨면
   *    시각적으로만 감추고 DOM 에는 남기는 의도된 설계다.
   */
  console.log('\n[2-B] 본문 상호작용 요소')
  for (const path of ['/', '/work', '/work/claude-board', '/team', '/contact']) {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const pg = await c.newPage()
    await pg.goto(BASE + path, { waitUntil: 'networkidle' })
    await pg.waitForTimeout(path === '/' ? ENTER_MS : 1500)
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
        /*
         * ⚠️ 중심이 아니라 **화면 안에 있는 지점**을 찍는다.
         *    위 걸러내기는 `q.y`(윗변)로 하는데 판정은 중심으로 해서,
         *    윗변만 화면에 걸친 큰 카드는 중심이 스크롤 아래라 `null` 이 나온다
         *    — 실측 2026-09-09: `/work` 카드가 3열→2열이 되며 세로로 길어지자
         *    멀쩡한 카드 2장이 "안 눌린다" 로 잡혔다(오탐).
         */
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

  // ── 3. 폴백 3단 ────────────────────────────────────────────────
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
    await p.waitForTimeout(opts.javaScriptEnabled === false ? 400 : ENTER_MS)
    const r = await p.evaluate(() => ({
      canvas: document.querySelectorAll('canvas').length,
      links: document.querySelectorAll(
        'a[href^="/work"],a[href^="/stack"],a[href^="/career"],a[href^="/team"],a[href^="/diagnose"],a[href^="/contact"]',
      ).length,
    }))
    ok(r.canvas === 0 && r.links === 10, label, `캔버스 ${r.canvas} · 링크 ${r.links}`)
    await c.close()
  }

  // ── 4. 크롤러가 받는 HTML (3D 와 독립이어야 한다) ────────────────
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
