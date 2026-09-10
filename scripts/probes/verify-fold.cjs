const { chromium } = require('./_pw.cjs')
let fail = 0
const ok = (c, l, d) => {
  if (!c) fail++
  console.log(`  ${c ? '✓' : '✗'} ${l}${d ? `  — ${d}` : ''}`)
}
;(async () => {
  const b = await chromium.launch()
  const pg = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  await pg.goto('http://localhost:3200/work', { waitUntil: 'networkidle' })
  await pg.waitForTimeout(4500)

  // 1. 접힌 태그가 실제로 안 보이는가 (display:contents 함정)
  // ⚠️ `[hidden]` 전체를 세면 무관한 요소가 잡혀 **검사 대상에 닿지 못한다**
  //    (실측: 첫 [hidden] 이 className 없는 남의 요소라 방어를 지워도 초록이었다).
  //    접힌 태그 **자식들의 실제 높이**를 본다.
  const fold = await pg.evaluate(() => {
    const wraps = [...document.querySelectorAll('[class*="rest"][hidden]')]
    let kids = 0,
      visible = 0
    for (const el of wraps) {
      for (const c of el.children) {
        kids++
        if (c.getBoundingClientRect().height > 0) visible++
      }
    }
    return { wraps: wraps.length, kids, visible }
  })
  ok(fold.wraps > 0, '접힌 태그 묶음을 찾았다', `묶음 ${fold.wraps}개 · 태그 ${fold.kids}개`)
  ok(
    fold.kids > 0 && fold.visible === 0,
    '접힌 태그가 실제로 안 보인다',
    `보이는 태그 ${fold.visible}개`,
  )

  // 2. 접힌 것이 HTML 에는 있는가 (크롤러)
  const html = await pg.content()
  ok(/Fastify/.test(html), '접힌 기술이 HTML 에 남아있다 (크롤러)', 'Fastify 검색')

  const before = (await pg.evaluate(() => document.body.innerText)).length

  // 3. 펼침 버튼이 동작하고, 카드 링크로 이동하지 않는가
  const url0 = pg.url()
  const btn = pg.locator('button:has-text("기술")').first()
  await btn.click()
  await pg.waitForTimeout(300)
  const after = (await pg.evaluate(() => document.body.innerText)).length
  ok(after > before, '펼치면 글자가 늘어난다', `${before} → ${after}`)
  ok(pg.url() === url0, '펼침 버튼이 카드 링크를 타지 않는다', pg.url())

  // 4. 다시 접힌다
  await pg.locator('button:has-text("기술 접기")').first().click()
  await pg.waitForTimeout(300)
  const back = (await pg.evaluate(() => document.body.innerText)).length
  ok(back === before, '다시 접으면 원래대로', `${back} vs ${before}`)

  // 5. 카드 본문 클릭은 여전히 상세로 간다
  await pg.locator('a[href="/work/claude-board"]').first().click()
  await pg.waitForTimeout(1200)
  ok(pg.url().includes('/work/claude-board'), '카드 클릭은 상세로 이동한다', pg.url())

  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
  process.exit(fail ? 1 : 0)
})()
