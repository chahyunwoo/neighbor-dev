/**
 * 복사본 생성 검증 — 방문자가 뺀 항목이 실제로 반영되는가.
 *
 * 돌리는 법:
 *   node --experimental-strip-types --test apps/web/src/lib/diagnose-copy.spec.mjs
 *
 * 🔴 `buildCopyText` 는 `DiagnoseResult.tsx` 에 있지만 **React 를 쓰지 않는
 *    순수 함수**라 여기서 직접 부른다. 화면을 띄우지 않고 확인할 수 있는
 *    것은 화면 없이 확인한다.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildCopyText, splitSections } from './diagnose-parse.ts'

const SAMPLE = `## 1. 무엇을 만드는 것인가

헬스장 회원 관리 웹입니다.

## 3. 범위를 어떻게 쪼갤지

- [먼저] 회원 등록·조회
- [먼저] 출석 체크
- [나중] 만료 알림

## 4. 어디가 오래 걸리고 위험한지

- [높음] 출석 방식 미정
`

test('아무것도 안 뺐으면 원문 그대로다', () => {
  assert.equal(buildCopyText(SAMPLE, new Set()), SAMPLE)
})

test('뺀 항목이 2차로 옮겨진다 — 지우지 않는다', () => {
  const out = buildCopyText(SAMPLE, new Set(['출석 체크']))
  assert.match(out, /- \[나중] 출석 체크\s+\(방문자가 1차에서 뺌\)/)
  // 🔴 지워지면 안 된다. "지금 안 한다" 와 "필요 없다" 는 다르다.
  assert.ok(out.includes('출석 체크'), '항목이 사라지면 안 된다')
  // 안 뺀 것은 그대로.
  assert.match(out, /- \[먼저] 회원 등록·조회/)
})

test('🔴 범위 절 밖의 **똑같은** 항목은 건드리지 않는다', () => {
  /*
   * ⚠️ 이 테스트는 두 번 고쳤다(2026-09-09 실측). 두 번 다 **가드를 꺼도 통과**했다.
   *    ① 처음엔 다른 절 항목이 `[높음]` 이라 parseScopeLine 이 null 을 냈다.
   *    ② 그 다음엔 `[먼저]` 로 바꿨지만 **텍스트가 달라** dropped 에 안 걸렸다.
   *    → 절 경계 가드가 실제로 작동하는 유일한 조건은
   *      **같은 텍스트의 `[먼저]` 줄이 범위 절 밖에도 있을 때** 다.
   *      그 조건을 만들어야 "왜 red 인지" 가 의도한 이유가 된다.
   */
  const doc = `## 3. 범위를 어떻게 쪼갤지

- [먼저] 출석 체크

## 5. 빠져 있어 물어봐야 할 것

- [먼저] 출석 체크
`
  const out = buildCopyText(doc, new Set(['출석 체크']))
  const marked = out.split('\n').filter((l) => l.includes('방문자가 1차에서 뺌'))
  assert.equal(marked.length, 1, '범위 절의 한 줄만 바뀌어야 한다 (5번 절은 그대로)')

  // 5번 절 쪽은 원래 표기를 유지해야 한다.
  const after5 = out.slice(out.indexOf('## 5'))
  assert.match(after5, /- \[먼저] 출석 체크\s*$/, '범위 절 밖은 손대지 않는다')
})

test('여러 개를 빼도 각각 반영된다', () => {
  const out = buildCopyText(SAMPLE, new Set(['회원 등록·조회', '만료 알림']))
  const marked = out.split('\n').filter((l) => l.includes('방문자가 1차에서 뺌'))
  assert.equal(marked.length, 2)
})

test('절을 나눈다 — 앞머리 숫자를 뗀다', () => {
  const { sections } = splitSections(SAMPLE)
  assert.deepEqual(
    sections.map((s) => s.title),
    ['무엇을 만드는 것인가', '범위를 어떻게 쪼갤지', '어디가 오래 걸리고 위험한지'],
  )
})
