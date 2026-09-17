/**
 * 이슈 #2 프로브 — 화면에 **실제로 보이는** 기술용어를 센다.
 *
 * 정적 regex 로는 못 잰다: `hidden` 은 속성이지만 실제 가시성은 CSS 가 정하고,
 * `.rest{display:contents}` 같은 것이 브라우저 기본값을 이길 수 있다
 * (ProjectLens 에서 실측된 함정). 그래서 innerText 로 잰다 —
 * innerText 는 보이는 것만 준다.
 */
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

/*
 * ⚠️ **스택명만 세면 제목의 개발 용어를 놓친다.**
 *    실측 2026-09-17(#80): 카드 제목이 `모노레포 — OpenAPI 타입 파이프라인` 이고
 *    도메인이 `모노레포 · 디자인시스템 · 공통 인프라` 인데 이 프로브는 **0을 셌다.**
 *    화면에서 가장 크게 보이는 글자가 검사 밖에 있었다.
 *    → 스택명(1행)과 **설명 언어**(2행)를 함께 센다.
 */
const PAT =
  /NestJS|Next\.js|Spring Boot|PostgreSQL|Docker|TypeScript|React|SSE|API|CRUD|JSONL|ProcessBuilder|NIO|RandomAccessFile|DTO|SwiftUI|launchd|멱등|상태 전이|스키마|파싱|캐시|쿼리|모노레포|OpenAPI|RFQ|콘솔|어드민|대시보드|CMS|SaaS|B2B|디자인시스템|컴포넌트|오픈소스|파이프라인|렌더링|인터랙티브|백엔드|프론트엔드|프론트|REST|MDX|Three\.js|SVG|Turborepo|멀티테넌트|위젯|스케줄러/g
/*
 * 화면별 상한(기술용어 수). ⚠️ 서버 주소인 `BASE` 와 헷갈리지 않게 이름을 가른다.
 *
 * 🔴 **넘으면 실패한다.** 전에는 숫자를 찍기만 하고 `exit 0` 이라, 늘어나도
 *    아무 일이 일어나지 않았다 — 계측기였지 게이트가 아니었다.
 *
 * 값은 #80 시점의 실측이다(PAT 를 제목·도메인 언어까지 넓힌 뒤 다시 잡았다).
 * 재현: `node scripts/probes/verify-jargon.cjs`
 *
 * ⚠️ **줄었다고 상한을 따라 내리지 않는다.** 상한은 "이 이상 늘면 회귀" 를 뜻하고,
 *    값에 맞춰 계속 조이면 무관한 문구 수정마다 빨개져 사람이 이 검사를 끈다.
 *    의도적으로 낮추는 것은 사람이 판단해서 한다.
 */
const BASELINE = { '/': 3, '/work': 46, '/work/claude-board': 25, '/career': 12, '/stack': 14 }

;(async () => {
  const b = await chromium.launch(LAUNCH)
  const over = []
  let totVis = 0,
    totBase = 0
  console.log('화면                     보이는글자   기술용어 기준선→보이는것   HTML안(크롤러)')
  for (const [p, base] of Object.entries(BASELINE)) {
    const ctx = await b.newContext()
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}${p}`, { waitUntil: 'networkidle' })
    const vis = await pg.evaluate(() => document.body.innerText)
    const html = await pg.content()
    const raw = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
    const nVis = (vis.match(PAT) || []).length
    const nAll = (raw.match(PAT) || []).length
    totVis += nVis
    totBase += base
    if (nVis > base) over.push({ p, base, n: nVis })
    console.log(
      `${p.padEnd(22)} ${String(vis.length).padStart(7)}   ${String(base).padStart(6)} → ${String(nVis).padEnd(6)}      ${nAll}`,
    )
    await ctx.close()
  }
  console.log(`\n합계  기술용어  상한 ${totBase} → 보이는 것 ${totVis}`)
  await b.close()
  if (over.length) {
    console.log('')
    for (const o of over) console.log(`🔴 ${o.p} — 상한 ${o.base} 인데 ${o.n} 개가 보인다`)
    console.log('화면의 큰 글씨는 발주자가 읽는 말이어야 한다. 늘었으면 이유를 본다.')
    process.exit(1)
  }
})()
