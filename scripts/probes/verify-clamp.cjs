// 한 페이지 안에서 연속으로 마커를 눌러도 전부 열리는가 — 마커마다 새 컨텍스트로 재면 이 버그를 못 본다
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

// 클램프 경계는 Scene.tsx 의 상수에서 읽는다 — 프로브에 숫자를 따로 박으면 둘이 어긋나도 모른다
const SCENE_DIR = join(__dirname, '../../apps/web/src/features/room-3d/scene')
const constOf = (file, name) => {
  const m = new RegExp(`const ${name} = (\\d+)`).exec(readFileSync(join(SCENE_DIR, file), 'utf8'))
  if (!m) throw new Error(`${file} 에서 ${name} 을 못 읽었다`)
  return Number(m[1])
}
const EDGE = {
  pad: constOf('Scene.tsx', 'EDGE_PAD'),
  gap: constOf('Scene.tsx', 'EDGE_GAP'),
  uiLeft: constOf('Scene.tsx', 'UI_LEFT'),
  panel: constOf('CameraRig.tsx', 'PANEL_WIDTH'),
}
/** 박스 판정 허용 오차(px) — 서브픽셀 반올림만. */
const BOX_TOL = 2

// 접힌 마커 버튼 중심이 클램프 박스 안인가, 제자리 마커와 EDGE_GAP 이상 떨어졌나. "캔버스 밖 0개" 만으로는 덜 간 마커를 못 잡는다
function inspectEdges(edge) {
  const f = document.querySelector('.canvas-frame').getBoundingClientRect()
  const box = {
    left: f.x + Math.min(edge.uiLeft, f.width * 0.5) + edge.pad,
    right:
      f.x +
      f.width -
      (document.documentElement.dataset.panelOpen === 'true' ? edge.panel : 0) -
      edge.pad,
    top: f.y + edge.pad,
    bottom: f.y + f.height - edge.pad,
  }
  const marks = [...document.querySelectorAll('.room-marker-wrap')].map((w) => {
    const r = w.querySelector('button').getBoundingClientRect()
    return {
      edge: w.dataset.edge === 'true',
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      half: Math.max(r.width, r.height) / 2,
    }
  })
  const edges = marks.filter((m) => m.edge)
  const rest = marks.filter((m) => !m.edge)
  // 클램프는 앵커를 접고 버튼은 앵커에서 반 칸 비켜 그려진다 — 버튼 반지름까지는 박스 밖이어도 정상이다
  const outBy = (m) =>
    Math.max(box.left - m.x, m.x - box.right, box.top - m.y, m.y - box.bottom, 0) - m.half
  // Scene 의 충돌 판정과 같은 축별 거리 — 두 축 다 EDGE_GAP 미만이면 겹친 것이다
  let gap = Infinity
  for (const e of edges)
    for (const q of rest) gap = Math.min(gap, Math.max(Math.abs(e.x - q.x), Math.abs(e.y - q.y)))
  return { n: edges.length, worstOut: Math.max(0, ...edges.map(outBy)), gap }
}
let fail = 0
const ok = (c, l, d) => {
  if (!c) fail++
  console.log(`  ${c ? '✓' : '✗'} ${l}${d ? `  — ${d}` : ''}`)
}
;(async () => {
  // headed 로 연다 — headless 는 12fps 로 떨어져 useEdgeClamp 의 매 프레임 재계산이 밀리고 클릭이 빗나간다
  const b = await chromium.launch(LAUNCH)
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    const pg = await (await b.newContext({ viewport: vp })).newPage()
    await pg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    // 시간이 아니라 상태로 기다린다 — 로딩이 느리면 첫 클릭이 입장 비행 중에 일어난다. RoomStage 가 입장 뒤 data-room-entered 를 남긴다
    await pg
      .waitForFunction(() => document.documentElement.dataset.roomEntered === 'true', {
        timeout: 15000,
      })
      .catch(() => {})
    await pg.waitForTimeout(600)

    // 접힌 마커 검사 — 입장 직후와, 오른쪽으로 마커를 밀어내는 드래그 뒤. 패널이 닫힌 상태여야 오른쪽 경계가 캔버스 끝이다
    {
      const seen = []
      // 패널을 열면 오른쪽 경계가 패널 폭만큼 들어와 보정량이 수백 px 가 된다 — 보정 크기 오류(#88)는 여기서만 드러난다
      for (const step of ['입장 직후', '드래그 뒤', '패널 연 뒤']) {
        if (step === '패널 연 뒤') {
          await pg.$eval('button[class*="marker"]', (e) => e.click())
          await pg.waitForTimeout(2600)
        }
        if (step === '드래그 뒤') {
          await pg.mouse.move(900, 460)
          await pg.mouse.down()
          for (let i = 1; i <= 30; i++) await pg.mouse.move(900 - (1400 * i) / 30, 460)
          await pg.mouse.up()
          await pg.waitForTimeout(1200)
        }
        const e = await pg.evaluate(inspectEdges, EDGE)
        seen.push(e.n)
        if (!e.n) continue
        ok(
          e.worstOut <= BOX_TOL,
          `${vp.width}x${vp.height} ${step} 접힌 마커가 클램프 박스 안`,
          `${e.n}개 · 최대 이탈 ${e.worstOut.toFixed(1)}px (허용 ${BOX_TOL})`,
        )
        ok(
          e.gap >= EDGE.gap - BOX_TOL,
          `${vp.width}x${vp.height} ${step} 접힌 마커가 제자리 마커와 안 겹친다`,
          `최소 축별 거리 ${e.gap.toFixed(1)}px (기준 ${EDGE.gap})`,
        )
      }
      // 양성 대조 — 접힌 마커가 하나도 없으면 위 검사가 아무것도 안 본 것이다
      ok(
        seen.some(Boolean),
        `   (대조) ${vp.width}x${vp.height} 접힌 마커를 실제로 봤다`,
        `${seen.join('·')}개`,
      )
    }
    // 드래그한 구도를 아래 연속 클릭 검사에 물려주지 않는다
    await pg.reload({ waitUntil: 'networkidle' })
    await pg
      .waitForFunction(() => document.documentElement.dataset.roomEntered === 'true', null, {
        timeout: 15000,
      })
      .catch(() => {})
    await pg.waitForTimeout(600)

    // nth(i) 로 집지 않는다 — 클램프가 DOM 순서를 바꾼다. aria-label 로 고정한다
    // 마커 7개가 다 뜰 때까지 기다린다 — 안 기다리면 일부만 세고 통과한다
    await pg.waitForFunction(
      () => document.querySelectorAll('button[class*="marker"]').length >= 7,
      null,
      { timeout: 15000 },
    )
    const labels = await pg
      .locator('button[class*="marker"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    const n = labels.length
    let opened = 0
    // 같은 페이지에서 연속으로 — 카메라가 움직인 뒤에도 눌려야 한다
    for (const lab of labels) {
      // 같은 aria-label 이 왼쪽 번호 목록에도 있다 — 마커로 한정하지 않으면 strict mode 위반
      const btn = pg.locator('button[class*="marker"]').and(pg.getByLabel(lab, { exact: true }))
      try {
        await btn.click({ timeout: 4000, force: true })
        await pg.waitForTimeout(1500)
        if ((await btn.getAttribute('aria-expanded')) === 'true') opened++
      } catch (e) {
        console.log('     · 실패:', lab, String(e.message).split('\n')[0].slice(0, 60))
      }
    }
    ok(
      opened === 7 && n === 7,
      `${vp.width}x${vp.height} 연속 클릭`,
      `${opened}/${n} 열림 (기대 7/7)`,
    )
    const out = await pg.evaluate(() => {
      // 3D 가 보이는 영역은 캔버스(뷰포트 전체)가 아니라 .canvas-frame 이다
      const c = document.querySelector('.canvas-frame').getBoundingClientRect()
      let n = 0
      document.querySelectorAll('button[class*="marker"]').forEach((el) => {
        const r = el.getBoundingClientRect()
        const x = r.x + r.width / 2,
          y = r.y + r.height / 2
        if (x < c.left || x > c.right || y < c.top || y > c.bottom) n++
      })
      return n
    })
    ok(out === 0, `${vp.width}x${vp.height} 캔버스 밖 마커 없음`, `${out}개`)
  }
  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
