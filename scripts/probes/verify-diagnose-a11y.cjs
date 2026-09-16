/**
 * 자가진단이 **스크린리더에게 끝까지 말해 주는가.**
 *
 * 🔴 이 검사가 없어서 못 잡은 것 (2026-09-16):
 *
 *    ① 대기 문구가 `% STEPS.length` 로 **무한 반복**됐다 — 응답이 늦으면
 *       같은 4문구를 계속 다시 읽는다. polite 라도 1.8초마다 읽던 자리를 끊는다.
 *    ② 라이브 영역이 **내용과 동시에 삽입**돼 첫 문구를 놓쳤다.
 *    ③ 결과가 오는 순간 그 영역이 통째로 사라져 **완전히 조용해졌다** —
 *       결과가 왔는지 실패했는지 알 방법이 없었다
 *       (실측: 결과 도착 후 `[aria-live],[role=status],[role=alert]` 0개).
 *
 * 🔴 **실제 API 를 부르지 않는다.** 일일 한도(30건)를 검사에 쓰면 안 되고,
 *    타이밍도 제어해야 한다 — 위 ①은 **응답이 느릴 때만** 드러난다.
 *    `page.route` 로 SSE 를 직접 만들어 8초 끌고 답한다.
 */
const { chromium, LAUNCH } = require('./_pw.cjs')
const BASE = process.env.WEB_BASE_URL || 'http://localhost:3200'

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
      // 느린 응답을 흉내낸다 — 대기 문구가 한 바퀴 돌고도 남을 만큼.
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

    // ② 제출 **전에** 라이브 영역이 이미 있어야 한다.
    const before = await pg.evaluate(
      () => document.querySelectorAll('[aria-live],[role="status"],[role="alert"]').length,
    )
    ok(before > 0, `[${mode}] 제출 전에 라이브 영역이 미리 있다`, `${before}개`)

    await pg.fill(
      '#requirement',
      '동네 헬스장에서 쓸 회원 관리 웹을 만들고 싶습니다. 회원 등록하고 출석 체크하고 이용권 남은 기간을 보는 정도요. 관리자는 두세 명이고 회원은 300명쯤 됩니다.',
    )
    await pg.click('button[type="submit"]')

    // 라이브 영역의 텍스트 변화를 기록한다.
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
    // ① 같은 문구가 두 번 나오면 순환한 것이다.
    const repeated = texts.filter((t, i) => texts.indexOf(t) !== i)
    ok(
      repeated.length === 0,
      `[${mode}] 대기 문구가 처음으로 되돌아가지 않는다`,
      repeated.length ? `되풀이: ${[...new Set(repeated)].join(' / ')}` : `${texts.length}단계`,
    )
    // ③ 끝난 뒤에도 알릴 자리가 남아 있어야 한다.
    ok(seen.alive > 0, `[${mode}] 끝난 뒤에도 라이브 영역이 남아 있다`, `${seen.alive}개`)
    if (mode === '실패') {
      ok(seen.alert.length > 0, '[실패] 실패를 role="alert" 로 알린다', seen.alert || '(없음)')
      /*
       * 🔴 **실패했는데 "결과" 를 말하면 안 된다.**
       *    처음 이 검사기는 실패 쪽에서 `alert` 존재와 영역 개수만 봤다.
       *    그래서 polite 영역이 `role="alert"` 직후에 **"결과를 아래에서 볼
       *    수 있습니다"** 를 읽는 것을 통째로 놓쳤다 — 결과 영역은 없었다.
       *    텍스트 단언이 **성공 쪽에만** 있으면 실패 쪽은 아무도 안 본다.
       */
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
