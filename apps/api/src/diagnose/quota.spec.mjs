/**
 * 쿼터 검증 — 기획서 5절이 "일일 총량 캡이 비용 방어의 본체" 라고 못박은 부분.
 *
 * 돌리는 법:  node --test apps/api/src/diagnose/quota.spec.mjs
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextMidnightKst, QuotaService } from '../../dist/diagnose/quota.service.js'

/** ConfigService 흉내 — 값을 주입해 경계를 정확히 친다. */
function svc(dailyCap, perIpHourly, contactDaily = 999, contactPerIp = 999) {
  const table = {
    AI_DAILY_TOTAL_CAP: dailyCap,
    AI_RATE_LIMIT_PER_IP_HOUR: perIpHourly,
    CONTACT_DAILY_CAP: contactDaily,
    CONTACT_RATE_LIMIT_PER_IP_HOUR: contactPerIp,
  }
  return new QuotaService({ get: (k) => table[k] })
}

test('일일 캡에 닿으면 막힌다 — 다른 IP 여도 막힌다', () => {
  // 캡 3, IP 시간당 넉넉히.
  const q = svc(3, 99)
  for (let i = 0; i < 3; i++) {
    assert.equal(q.check(`10.0.0.${i}`).allowed, true, `${i}번째는 통과해야 한다`)
    q.consume(`10.0.0.${i}`)
  }
  // 🔴 IP 를 바꿔도 막혀야 한다 — 이것이 IP 제한과 총량 캡의 차이다.
  const d = q.check('10.0.0.99')
  assert.equal(d.allowed, false)
  assert.equal(d.reason, 'daily-cap')
  assert.ok(d.retryAfterSeconds > 0, '언제 풀리는지 알려줘야 한다')
})

test('IP 시간당 제한은 그 IP 만 막는다', () => {
  const q = svc(999, 2)
  q.consume('1.1.1.1')
  q.consume('1.1.1.1')
  assert.equal(q.check('1.1.1.1').allowed, false, '같은 IP 는 막힌다')
  assert.equal(q.check('1.1.1.1').reason, 'ip-hourly')
  assert.equal(q.check('2.2.2.2').allowed, true, '다른 IP 는 통과한다')
})

test('check 는 소비하지 않는다 — 모델 호출이 실패해도 캡이 안 깎인다', () => {
  const q = svc(2, 99)
  q.check('1.1.1.1')
  q.check('1.1.1.1')
  q.check('1.1.1.1')
  assert.equal(q.snapshot().dailyUsed, 0, 'check 만으로는 소비되지 않아야 한다')
  q.consume('1.1.1.1')
  assert.equal(q.snapshot().dailyUsed, 1)
})

test('남은 횟수를 화면에 줄 수 있다', () => {
  const q = svc(5, 99)
  q.consume('1.1.1.1')
  const s = q.snapshot()
  assert.equal(s.dailyCap, 5)
  assert.equal(s.dailyUsed, 1)
})

test('자정(KST) 리셋 시각을 정확히 계산한다', () => {
  // 2026-09-09 12:00 KST = 2026-09-09 03:00 UTC
  const noonKst = Date.UTC(2026, 8, 9, 3, 0, 0)
  const next = nextMidnightKst(noonKst)
  // 2026-09-10 00:00 KST = 2026-09-09 15:00 UTC
  assert.equal(next, Date.UTC(2026, 8, 9, 15, 0, 0))
  assert.ok(next > noonKst, '항상 미래여야 한다')

  // 자정 직전(23:59 KST)에도 그날의 자정이 아니라 다음 자정을 준다.
  const almost = Date.UTC(2026, 8, 9, 14, 59, 0)
  assert.equal(nextMidnightKst(almost), Date.UTC(2026, 8, 9, 15, 0, 0))
})

test('용도가 서로의 예산을 깎지 않는다', () => {
  // 🔴 이것이 용도를 나눈 이유다 — 진단을 많이 쓴 날에 문의가 막히면 안 된다.
  const q = svc(2, 99, 5, 99)
  q.consume('1.1.1.1', 'diagnose')
  q.consume('1.1.1.1', 'diagnose')
  assert.equal(q.check('1.1.1.1', 'diagnose').allowed, false, '진단은 캡에 닿았다')
  assert.equal(q.check('1.1.1.1', 'contact').allowed, true, '문의는 그대로 열려 있어야 한다')
})

test('용도별 IP 제한도 따로 센다', () => {
  const q = svc(999, 1, 999, 1)
  q.consume('1.1.1.1', 'diagnose')
  assert.equal(q.check('1.1.1.1', 'diagnose').allowed, false)
  assert.equal(q.check('1.1.1.1', 'contact').allowed, true, '같은 IP 라도 용도가 다르면 별개')
})

test('snapshot 이 용도별로 답한다', () => {
  const q = svc(10, 99, 20, 99)
  q.consume('1.1.1.1', 'contact')
  assert.equal(q.snapshot('diagnose').dailyCap, 10)
  assert.equal(q.snapshot('diagnose').dailyUsed, 0)
  assert.equal(q.snapshot('contact').dailyCap, 20)
  assert.equal(q.snapshot('contact').dailyUsed, 1)
})
