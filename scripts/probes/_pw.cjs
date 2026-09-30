// Playwright 로더 — 모든 프로브가 거친다. 절대경로를 박지 않고 PROBE_PW → 저장소 node_modules → 기본 해석 순으로 찾는다
const { createRequire } = require('node:module')
const { existsSync } = require('node:fs')
const { join } = require('node:path')

// headless 로 열되 실제 GPU(ANGLE)를 쓴다 — 기본 SwiftShader 는 11fps 로 떨어져 3D 모션에서 없는 증상이 만들어진다
const GPU_ARGS =
  process.platform === 'darwin'
    ? ['--use-angle=metal', '--enable-gpu']
    : ['--enable-gpu', '--use-gl=angle']

const LAUNCH = { headless: true, args: GPU_ARGS }

// 검사할 서버 주소는 여기 한 곳에서만 준다 — 프로브가 포트를 박으면 조용히 다른 서버를 검사한다
const BASE = process.env.WEB_BASE_URL || 'http://localhost:21200'

function load() {
  const tries = []

  if (process.env.PROBE_PW) {
    tries.push(join(process.env.PROBE_PW, 'playwright'))
  }
  // 저장소 루트까지 위로 올라가며 찾는다(pnpm 은 루트에 심는다)
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

module.exports = { ...load(), LAUNCH, BASE }
