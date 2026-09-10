/**
 * 이슈 #2 프로브 — 화면에 **실제로 보이는** 기술용어를 센다.
 *
 * 정적 regex 로는 못 잰다: `hidden` 은 속성이지만 실제 가시성은 CSS 가 정하고,
 * `.rest{display:contents}` 같은 것이 브라우저 기본값을 이길 수 있다
 * (ProjectLens 에서 실측된 함정). 그래서 innerText 로 잰다 —
 * innerText 는 보이는 것만 준다.
 */
const { chromium } = require('./_pw.cjs')

const PAT =
  /NestJS|Next\.js|Spring Boot|PostgreSQL|Docker|TypeScript|React|SSE|API|CRUD|JSONL|ProcessBuilder|NIO|RandomAccessFile|DTO|SwiftUI|launchd|멱등|상태 전이|스키마|파싱|캐시|쿼리/g
const BASE = { '/': 3, '/work': 50, '/work/claude-board': 30, '/career': 18, '/stack': 11 }

;(async () => {
  const b = await chromium.launch()
  let totVis = 0,
    totBase = 0
  console.log('화면                     보이는글자   기술용어 기준선→보이는것   HTML안(크롤러)')
  for (const [p, base] of Object.entries(BASE)) {
    const ctx = await b.newContext()
    const pg = await ctx.newPage()
    await pg.goto(`http://localhost:3200${p}`, { waitUntil: 'networkidle' })
    const vis = await pg.evaluate(() => document.body.innerText)
    const html = await pg.content()
    const raw = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
    const nVis = (vis.match(PAT) || []).length
    const nAll = (raw.match(PAT) || []).length
    totVis += nVis
    totBase += base
    console.log(
      `${p.padEnd(22)} ${String(vis.length).padStart(7)}   ${String(base).padStart(6)} → ${String(nVis).padEnd(6)}      ${nAll}`,
    )
    await ctx.close()
  }
  console.log(`\n합계  기술용어  기준선 ${totBase} → 보이는 것 ${totVis}`)
  await b.close()
})()
