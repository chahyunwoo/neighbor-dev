// 내부 토큰 가드가 **앱에 실제로 걸려 있는지** 본다. 순수 함수 스펙(internal-token.spec.mjs)은
// APP_GUARD 등록을 지워도 green 이라 배선을 못 잡는다(#114).
// 돌리는 법: pnpm --filter @neighbor/api build && node --test apps/api/src/internal-token.e2e.spec.mjs
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

const TOKEN = 'e2e-internal-token'
const API_DIR = join(import.meta.dirname, '..')

// 공유 자원이라 고정 포트를 잡지 않는다 — 다른 세션이 쓰고 있을 수 있다
function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.on('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

let child
let base

before(async () => {
  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  child = spawn(process.execPath, ['dist/main.js'], {
    cwd: API_DIR,
    stdio: 'ignore',
    env: {
      ...process.env,
      API_PORT: String(port),
      API_HOST: '127.0.0.1',
      INTERNAL_TOKEN: TOKEN,
      // 이 검사의 대상이 아니다. 켜면 모델·메일·사람확인 설정까지 필요해진다
      ANTHROPIC_API_KEY: '',
      TURNSTILE_SECRET: '',
      API_DOCS: '',
    },
  })
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return
    } catch {
      // 아직 안 떴다
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('api 가 뜨지 않았다')
})

after(() => child?.kill())

test('토큰이 없으면 막는다 — 터널 주소로 직접 들어오는 요청', async () => {
  const res = await fetch(`${base}/contact/status`)
  assert.equal(res.status, 403)
})

test('토큰이 틀리면 막는다', async () => {
  const res = await fetch(`${base}/contact/status`, {
    headers: { 'x-internal-token': `${TOKEN}-wrong` },
  })
  assert.equal(res.status, 403)
})

test('토큰이 맞으면 통과한다', async () => {
  const res = await fetch(`${base}/contact/status`, { headers: { 'x-internal-token': TOKEN } })
  assert.equal(res.status, 200)
})

test('진단 쪽도 같은 가드를 지난다', async () => {
  assert.equal((await fetch(`${base}/diagnose/status`)).status, 403)
  const ok = await fetch(`${base}/diagnose/status`, { headers: { 'x-internal-token': TOKEN } })
  assert.equal(ok.status, 200)
})

test('/health 만 토큰 없이 열린다 — 터널·launchd 가 이걸로 생사를 본다', async () => {
  const res = await fetch(`${base}/health`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
})

test('운영에서 Swagger 가 열리지 않는다', async () => {
  assert.equal((await fetch(`${base}/docs`)).status, 404)
})
