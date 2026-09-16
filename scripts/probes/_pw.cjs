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

/**
 * 프로브 공통 실행 옵션 — **headless 로 열되 진짜 GPU 를 쓴다.**
 *
 * 🔴 headless 의 기본 렌더러는 SwiftShader(소프트웨어)라 **11fps** 로 떨어진다.
 *    그 상태로 3D 모션을 재면 **없는 증상이 만들어진다**(CLAUDE.md) —
 *    `verify-clamp` 가 5회 중 3회 실패했고 실패 해상도도 매번 달랐다.
 *
 *    그래서 한동안 `headless: false` 로 돌렸는데, 그러면 **진짜 창이 뜬다.**
 *    `canvas-probe` 는 마커마다 새 컨텍스트를 열어 창이 연달아 튀어나오고,
 *    그게 작업을 방해했다(사용자 지적). `--window-position` 으로 화면 밖에
 *    보내려 했지만 macOS 는 그 좌표를 무시했다.
 *
 * 🔴 **답은 `--use-angle`.** 실측 2026-09-16:
 *
 *      headless 기본            11fps   ANGLE (SwiftShader)
 *      headless + angle=metal   61fps   ANGLE (Apple M3 GPU)
 *
 *    창을 안 띄우고도 실제 GPU 로 돈다. headed 가 애초에 필요 없었다.
 */
const GPU_ARGS =
  process.platform === 'darwin'
    ? ['--use-angle=metal', '--enable-gpu']
    : ['--enable-gpu', '--use-gl=angle']

/** 모든 프로브가 쓰는 실행 옵션. `chromium.launch(LAUNCH)` */
const LAUNCH = { headless: true, args: GPU_ARGS }

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

module.exports = { ...load(), LAUNCH }
