/**
 * 출력 게이트 검증.
 *
 * 🔴 "게이트가 있다" 와 "게이트가 잡는다" 는 다르다. 통과해야 하는 것과
 *    막혀야 하는 것을 **둘 다** 검사한다 — 한쪽만 보면 전부 막는 게이트도
 *    통과한다(위양성이 안 보인다).
 *
 * 돌리는 법:  node --test apps/api/src/diagnose/diagnose.guard.spec.mjs
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkOutput } from '../../dist/diagnose/diagnose.guard.js'

/** 막혀야 하는 것 — 금액. */
const MUST_BLOCK_MONEY = [
  '개발 비용은 대략 500만원 정도로 예상됩니다.',
  '총 1,200,000원 수준입니다.',
  '예산은 3천만 원 정도 잡으시면 됩니다.',
  '대략 $8,000 정도입니다.',
  '인건비를 고려하면 규모가 커집니다.',
  'MM 단가는 별도로 산정됩니다.',
  '견적 금액은 범위에 따라 달라집니다.',
  '비용은 약 2000만원입니다.',
]

/** 막혀야 하는 것 — 실적 날조. */
const MUST_BLOCK_FABRICATION = [
  '저희가 비슷한 쇼핑몰을 만든 적 있습니다.',
  '우리는 물류 시스템을 구축한 적이 있어 익숙합니다.',
  '이웃집 개발자가 유사한 프로젝트를 납품했습니다.',
  '비슷한 사례를 진행했습니다.',
]

/** 통과해야 하는 것 — 프롬프트가 시키는 정상 출력. */
const MUST_PASS = [
  '전체 개발은 약 8주 정도로 예상됩니다.',
  '화면은 5개, API 는 12개 정도가 필요합니다.',
  '결제 연동이 가장 오래 걸립니다. 3주 정도 잡으세요.',
  '프론트는 Next.js, 백엔드는 NestJS 를 권합니다.',
  '비용은 범위가 정해진 뒤 사람이 직접 산정합니다.',
  '1단계에서 상품 등록까지, 2단계에서 결제를 붙이는 것을 권합니다.',
  '동시 접속 1000명을 감당하려면 캐시 계층이 필요합니다.',
  '요구사항에 없는 것: 관리자 권한 체계를 어떻게 나눌지.',
]

test('금액 표현은 막힌다', () => {
  for (const s of MUST_BLOCK_MONEY) {
    const r = checkOutput(s)
    assert.equal(r.ok, false, `막혔어야 한다: ${s}`)
    assert.ok(r.violations.includes('money'), `money 로 잡혔어야 한다: ${s}`)
  }
})

test('실적 날조는 막힌다', () => {
  for (const s of MUST_BLOCK_FABRICATION) {
    const r = checkOutput(s)
    assert.equal(r.ok, false, `막혔어야 한다: ${s}`)
    assert.ok(r.violations.includes('fabricated-record'), `날조로 잡혔어야 한다: ${s}`)
  }
})

test('정상 출력은 통과한다 — 위양성이 없다', () => {
  for (const s of MUST_PASS) {
    const r = checkOutput(s)
    assert.equal(
      r.ok,
      true,
      `통과했어야 한다: ${s} (걸림: ${r.violations.join(',')} / ${r.samples[0]})`,
    )
  }
})

test('걸린 대목을 남긴다 — 로그로 원인을 볼 수 있게', () => {
  const r = checkOutput('앞부분입니다. 비용은 500만원 정도입니다. 뒷부분입니다.')
  assert.equal(r.ok, false)
  assert.ok(r.samples[0].includes('500만원'), `걸린 대목이 있어야 한다: ${r.samples[0]}`)
})
