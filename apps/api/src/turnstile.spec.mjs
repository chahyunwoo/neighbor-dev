// 사람 확인(Turnstile) 판정.
// 돌리는 법: pnpm --filter @neighbor/api build && node --test apps/api/src/turnstile.spec.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { turnstileAllows } from '../dist/turnstile.service.js'

const reply = (body) => async () => ({ json: async () => body })

test('시크릿이 없으면 검증하지 않는다 — 로컬 개발', async () => {
  assert.equal((await turnstileAllows(undefined, undefined, '1.1.1.1')).ok, true)
})

test('시크릿이 있는데 토큰이 없으면 막는다', async () => {
  const r = await turnstileAllows('s', undefined, '1.1.1.1', reply({ success: true }))
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'missing-token')
})

test('Cloudflare 가 success 를 줄 때만 통과한다', async () => {
  assert.equal((await turnstileAllows('s', 't', '1.1.1.1', reply({ success: true }))).ok, true)
  const bad = await turnstileAllows('s', 't', '1.1.1.1', reply({ success: false, 'error-codes': ['timeout-or-duplicate'] }))
  assert.equal(bad.ok, false)
  assert.equal(bad.reason, 'timeout-or-duplicate')
})

test('검증 호출이 실패하면 막는다 — 장애가 우회로가 되면 안 된다', async () => {
  const r = await turnstileAllows('s', 't', '1.1.1.1', async () => {
    throw new Error('network')
  })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'verify-unreachable')
})

test('비밀키·토큰·방문자 IP 를 그대로 보낸다', async () => {
  let sent
  await turnstileAllows('secret-x', 'token-y', '9.9.9.9', async (_url, init) => {
    sent = Object.fromEntries(init.body)
    return { json: async () => ({ success: true }) }
  })
  assert.deepEqual(sent, { secret: 'secret-x', response: 'token-y', remoteip: '9.9.9.9' })
})
