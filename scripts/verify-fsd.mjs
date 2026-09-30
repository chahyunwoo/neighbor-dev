// FSD 레이어 규칙 검사 — 단방향 의존(type-only 포함), 슬라이스는 index.ts 로만, 슬라이스 밖 상대경로 금지.
// 돌리는 법: node scripts/verify-fsd.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = 'apps/web/src'
const SRCS = [SRC]
// 위에서 아래로 — 아래일수록 하위 레이어
const ORDER = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

const problems = []
for (const SRC of SRCS)
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file)
    const [layer, slice] = rel.split('/')
    // 주석을 먼저 지운다 — 주석 속 설명 문구의 from '...' 를 import 로 오인한다
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    for (const m of src.matchAll(/from '([^']+)'/g)) {
      const spec = m[1]

      // 상대경로는 같은 슬라이스(shared 는 같은 세그먼트) 안에서만 허용한다 — 세그먼트 내부는 배럴로 부르면 순환 import 가 된다
      if (spec.startsWith('../')) {
        const here = relative(SRC, join(file, '..', spec)).split('/')
        const mineParts = rel.split('/')
        // layer + slice(shared 는 segment) 두 단계가 같으면 같은 울타리 안
        const same = here[0] === mineParts[0] && here[1] === mineParts[1]
        if (!same) {
          problems.push(`${SRC}: 슬라이스 밖으로 나가는 상대경로: ${rel} → ${spec}`)
        }
        continue
      }
      if (!spec.startsWith('@/')) continue

      const [depLayer, depSlice, ...rest] = spec.slice(2).split('/')
      const here = ORDER.indexOf(layer)
      const there = ORDER.indexOf(depLayer)
      if (here === -1 || there === -1) continue

      // 하위(인덱스 큼)가 상위(인덱스 작음)를 부르면 위반
      if (there < here) {
        problems.push(`${SRC}: 단방향 위반: ${layer} → ${depLayer}  (${rel} → ${spec})`)
        continue
      }
      // 같은 레이어 다른 슬라이스 횡단 금지 — shared 는 슬라이스가 아니라 세그먼트라 예외
      if (there === here && depSlice !== slice && layer !== 'shared') {
        problems.push(`${SRC}: 같은 레이어 횡단: ${rel} → ${spec}`)
        continue
      }
      // 다른 슬라이스 내부 파일 직접 참조 금지(index.ts 로만). CSS Module 은 재노출이 안 돼 예외
      // shared 는 세그먼트까지가 public API — 통짜 @/shared 는 순환 참조를 만들기 쉬워 막는다
      if (depLayer === 'shared') {
        if (!depSlice) {
          problems.push(`${SRC}: 통짜 @/shared 금지(세그먼트를 쓴다): ${rel} → ${spec}`)
          continue
        }
        if (rest.length > 0 && !spec.endsWith('.css')) {
          problems.push(`${SRC}: shared 세그먼트 내부 직접 참조: ${rel} → ${spec}`)
        }
        continue
      }
      if (there > here && rest.length > 0 && !spec.endsWith('.css')) {
        problems.push(`${SRC}: 슬라이스 내부 직접 참조: ${rel} → ${spec}`)
      }
    }
  }

if (problems.length) {
  process.stderr.write(`FSD 검사 — ${problems.length}건 위반\n`)
  for (const p of problems) process.stderr.write(`  ${p}\n`)
  process.exit(1)
}
process.stdout.write('FSD 검사 통과 — 단방향 의존 · 슬라이스 public API · 절대경로\n')
