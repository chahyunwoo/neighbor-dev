// 자가진단이 스크린리더에게 시작·진행·끝을 알리는가 — 대기 문구가 순환하지 않고, 라이브 영역이 제출 전부터 끝난 뒤까지 남는가.
// 실제 API 를 부르지 않는다(일일 한도 보호·타이밍 제어) — page.route 로 SSE 를 8초 끌어 답한다
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

const sse = (o) => `data: ${JSON.stringify(o)}\n\n`

;(async () => {
  const b = await chromium.launch(LAUNCH)
  let fail = 0
  const ok = (c, label, detail) => {
    if (!c) fail++
    console.log(`  ${c ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`)
  }

  for (const mode of ['성공', '실패']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
    const pg = await ctx.newPage()
    await pg.route('**/api/diagnose/stream', async (route) => {
      // 느린 응답 — 대기 문구가 한 바퀴 돌고도 남을 만큼
      await new Promise((r) => setTimeout(r, 8000))
      if (mode === '실패') {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: sse({ ok: false, message: '지금은 처리할 수 없습니다.' }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse({ text: '## 범위\n\n- 회원 등록\n- 출석 체크\n' }),
      })
    })

    await pg.goto(`${BASE}/diagnose`, { waitUntil: 'load' })
    await pg.waitForTimeout(1200)

    // ② 제출 전에 라이브 영역이 이미 있어야 한다
    const before = await pg.evaluate(
      () => document.querySelectorAll('[aria-live],[role="status"],[role="alert"]').length,
    )
    ok(before > 0, `[${mode}] 제출 전에 라이브 영역이 미리 있다`, `${before}개`)

    await pg.fill(
      '#requirement',
      '동네 헬스장에서 쓸 회원 관리 웹을 만들고 싶습니다. 회원 등록하고 출석 체크하고 이용권 남은 기간을 보는 정도요. 관리자는 두세 명이고 회원은 300명쯤 됩니다.',
    )
    await pg.click('button[type="submit"]')

    const seen = await pg.evaluate(
      () =>
        new Promise((res) => {
          const out = []
          const t0 = performance.now()
          const read = () => {
            const el = document.querySelector('[role="status"],[aria-live]')
            const t = (el?.textContent ?? '').trim()
            if (t && out.at(-1)?.t !== t) out.push({ t, at: Math.round(performance.now() - t0) })
            if (performance.now() - t0 < 12000) setTimeout(read, 120)
            else
              res({
                out,
                alive: document.querySelectorAll('[aria-live],[role="status"],[role="alert"]')
                  .length,
                alert: (document.querySelector('[role="alert"]')?.textContent ?? '').trim(),
              })
          }
          read()
        }),
    )
    await ctx.close()

    const texts = seen.out.map((x) => x.t)
    // ① 같은 문구가 두 번 나오면 순환한 것
    const repeated = texts.filter((t, i) => texts.indexOf(t) !== i)
    ok(
      repeated.length === 0,
      `[${mode}] 대기 문구가 처음으로 되돌아가지 않는다`,
      repeated.length ? `되풀이: ${[...new Set(repeated)].join(' / ')}` : `${texts.length}단계`,
    )
    // ③ 끝난 뒤에도 알릴 자리가 남아 있어야 한다
    ok(seen.alive > 0, `[${mode}] 끝난 뒤에도 라이브 영역이 남아 있다`, `${seen.alive}개`)
    if (mode === '실패') {
      ok(seen.alert.length > 0, '[실패] 실패를 role="alert" 로 알린다', seen.alert || '(없음)')
      // 실패했는데 "결과" 를 말하면 안 된다 — 텍스트 단언이 성공 쪽에만 있으면 실패 쪽은 아무도 안 본다
      const last = texts.at(-1) ?? ''
      ok(
        !/결과|끝났습니다/.test(last),
        '[실패] 안내가 "결과" 를 말하지 않는다',
        last || '(비어 있음 — 정상)',
      )
    } else {
      ok(
        texts.some((t) => t.includes('끝났습니다')),
        '[성공] 끝났다는 것을 알린다',
        texts.at(-1) ?? '(없음)',
      )
    }
  }

  await b.close()
  console.log(fail ? `\n실패 ${fail}건` : '\n자가진단이 시작·진행·끝을 전부 알린다')
  process.exit(fail ? 1 : 0)
})()
