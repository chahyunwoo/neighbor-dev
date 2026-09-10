/**
 * Playwright 로더 — 모든 프로브가 여기를 거친다.
 *
 * 🔴 **절대경로를 프로브에 박지 않는다.** 예전에는 각 파일이 스크래치패드
 *    절대경로를 들고 있어서, 저장소를 다른 환경으로 옮기면 **전부 못 돌았다**
 *    (이슈 #26). 이제 설치된 곳을 순서대로 찾는다.
 *
 * 우선순위:
 *   1. `PROBE_PW` 환경변수 (직접 지정할 때)
 *   2. 저장소의 node_modules (`pnpm add -Dw playwright` 로 설치된 것)
 *   3. require 기본 해석
 */
const { createRequire } = require('node:module')
const { existsSync } = require('node:fs')
const { join } = require('node:path')

function load() {
  const tries = []

  if (process.env.PROBE_PW) {
    tries.push(join(process.env.PROBE_PW, 'playwright'))
  }
  // 저장소 루트에서 위로 올라가며 찾는다(pnpm 은 루트에 심는다)
  let dir = __dirname
  for (let i = 0; i < 5; i++) {
    tries.push(join(dir, 'node_modules', 'playwright'))
    dir = join(dir, '..')
  }
  tries.push('playwright')

  for (const p of tries) {
    try {
      if (p !== 'playwright' && !existsSync(p)) continue
      return createRequire(__filename)(p)
    } catch {
      // 다음 후보로
    }
  }

  process.stderr.write(
    'playwright 를 찾지 못했다.\n' +
      '  pnpm add -Dw playwright && pnpm exec playwright install chromium\n' +
      '  (또는 PROBE_PW=<node_modules 경로> 로 지정)\n',
  )
  process.exit(2)
}

module.exports = load()
