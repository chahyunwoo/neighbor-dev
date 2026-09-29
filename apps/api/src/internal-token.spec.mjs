/**
 * 내부 토큰 판정 — 막혀야 하는 것과 통과해야 하는 것을 둘 다 본다.
 *
 * 돌리는 법:  node --test apps/api/src/internal-token.spec.mjs  (먼저 pnpm --filter @neighbor/api build)
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { internalTokenAllows } from '../dist/internal-token.js'

const TOKEN = 's3cret-token-value'

test('토큰이 맞으면 통과한다', () => {
  assert.equal(internalTokenAllows(TOKEN, TOKEN, '/contact'), true)
})

test('토큰이 없거나 다르면 막는다', () => {
  for (const got of [undefined, '', 'wrong', `${TOKEN}x`, TOKEN.slice(0, -1), [TOKEN]]) {
    assert.equal(internalTokenAllows(TOKEN, got, '/contact'), false, String(got))
  }
})

test('상태 조회·진단도 막는다 — /health 만 예외다', () => {
  for (const path of ['/contact/status', '/diagnose', '/diagnose/stream', '/diagnose/status']) {
    assert.equal(internalTokenAllows(TOKEN, undefined, path), false, path)
  }
  assert.equal(internalTokenAllows(TOKEN, undefined, '/health'), true)
})

test('토큰을 설정하지 않은 환경은 전부 통과한다', () => {
  assert.equal(internalTokenAllows(undefined, undefined, '/contact'), true)
  assert.equal(internalTokenAllows('', undefined, '/contact'), true)
})
