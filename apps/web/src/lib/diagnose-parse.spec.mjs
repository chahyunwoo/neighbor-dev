/**
 * 자가진단 파서 검증.
 *
 * 돌리는 법:  node --experimental-strip-types --test apps/web/src/lib/diagnose-parse.spec.mjs
 *
 * 🔴 여기서 확인하려는 것은 "형식에 맞으면 잡는다" 만이 아니다.
 *    **형식이 어긋났을 때 조용히 문단으로 떨어지는가** 가 같은 무게로 중요하다 —
 *    스트리밍 도중에는 줄이 반쯤 온 상태가 매번 정상이기 때문이다.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isPeriodSection,
  isRiskSection,
  isScopeSection,
  parsePeriod,
  parseRiskLine,
  parseScopeLine,
} from './diagnose-parse.ts'

test('범위 줄을 먼저/나중으로 가른다', () => {
  assert.deepEqual(parseScopeLine('- [먼저] 회원 등록·조회'), {
    first: true,
    text: '회원 등록·조회',
  })
  assert.deepEqual(parseScopeLine('- [나중] 만료 임박 알림'), {
    first: false,
    text: '만료 임박 알림',
  })
})

test('전각 대괄호와 다른 불릿 기호도 받는다', () => {
  // 모델이 전각을 쓰는 경우가 있다.
  assert.deepEqual(parseScopeLine('* ［먼저］ 출석 체크'), { first: true, text: '출석 체크' })
  assert.deepEqual(parseScopeLine('· [나중] 통계'), { first: false, text: '통계' })
})

test('형식에 안 맞는 줄은 null 이다 — 버리지 않고 문단으로 떨어뜨리기 위해서다', () => {
  assert.equal(parseScopeLine('그냥 문단입니다'), null)
  assert.equal(parseScopeLine('- 대괄호 없는 목록'), null)
  // 🔴 스트리밍 도중 반쯤 온 줄. 여기서 예외가 나면 화면이 통째로 죽는다.
  assert.equal(parseScopeLine('- [먼'), null)
  assert.equal(parseScopeLine('- [먼저]'), null, '내용이 비면 항목이 아니다')
  assert.equal(parseScopeLine(''), null)
})

test('위험 줄에서 등급을 뽑는다', () => {
  assert.deepEqual(parseRiskLine('- [높음] 출석 방식이 안 정해졌습니다'), {
    level: '높음',
    text: '출석 방식이 안 정해졌습니다',
  })
  assert.equal(parseRiskLine('- [중간] 예외 규칙').level, '중간')
  assert.equal(parseRiskLine('- [낮음] 기본 CRUD').level, '낮음')
})

test('없는 등급은 받지 않는다', () => {
  assert.equal(parseRiskLine('- [매우높음] 위험'), null)
  assert.equal(parseRiskLine('- [먼저] 이건 범위 항목이다'), null)
})

test('기간을 범위로 읽는다 — 괄호 안에 "주" 가 붙은 형태도 받는다', () => {
  // 실측 2026-09-09: 모델이 두 형태를 다 쓴다.
  assert.deepEqual(parsePeriod('8주 (6~10)').typical, 8)
  const a = parsePeriod('8주 (6~10)')
  assert.equal(a.min, 6)
  assert.equal(a.max, 10)

  const b = parsePeriod('6주 (4~9주)')
  assert.deepEqual([b.typical, b.min, b.max], [6, 4, 9])

  // 하이픈·전각 괄호·공백 변형
  assert.deepEqual([parsePeriod('8주(6-10주)').min, parsePeriod('8 주 ( 6 ~ 10 )').max], [6, 10])
})

test('기간 설명을 본문에서 함께 뽑는다', () => {
  const p = parsePeriod('6주 (4~9주)\n\n출석 방식이 안 정해져 폭을 넓게 잡았습니다.')
  assert.equal(p.note, '출석 방식이 안 정해져 폭을 넓게 잡았습니다.')
})

test('🔴 범위가 없으면 null 이다 — 폭을 지어내지 않는다', () => {
  // 단일 값만 왔을 때 min=max=typical 로 채우면 그게 근거 없는 수치다.
  assert.equal(parsePeriod('8주'), null)
  assert.equal(parsePeriod('대략 두 달쯤'), null)
})

test('뒤집힌 범위는 받지 않는다', () => {
  assert.equal(parsePeriod('8주 (10~6)'), null, '화면에 "10~6주" 가 나가면 더 나쁘다')
})

test('절 제목을 알아본다', () => {
  assert.equal(isScopeSection('범위를 어떻게 쪼갤지'), true)
  assert.equal(isRiskSection('어디가 오래 걸리고 위험한지'), true)
  assert.equal(isPeriodSection('기간'), true)
  assert.equal(isScopeSection('필요한 기술'), false)
  assert.equal(isRiskSection('빠져 있어 물어봐야 할 것'), false)
})
