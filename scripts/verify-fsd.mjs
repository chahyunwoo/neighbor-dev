/**
 * FSD 레이어 규칙 검사 (전역 규칙 `frontend-react-fsd`).
 *
 * 🔴 **단방향 의존 — 예외 없이 지킨다.** 하위 레이어는 상위를 import 하지 않는다.
 *    type-only 여도 컴파일 타임 레이어 위반이므로 "type 이니까 괜찮다" 로 넘기지 않는다.
 * 🔴 **슬라이스는 `index.ts` 로만 노출한다.** 다른 슬라이스의 내부 파일을
 *    직접 import 하지 않는다.
 * 🔴 **상대경로(`../`) 금지.** 같은 폴더 `./` 만 허용.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = 'apps/web/src'
/** 위에서 아래로. 아래일수록 하위 레이어다. */
const ORDER = ['app', 'widgets', 'features', 'entities', 'shared']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

const problems = []
for (const file of walk(SRC)) {
  const rel = relative(SRC, file)
  const [layer, slice] = rel.split('/')
  const src = readFileSync(file, 'utf8')

  for (const m of src.matchAll(/from '([^']+)'/g)) {
    const spec = m[1]

    // 상대경로 — 같은 폴더(./) 만 허용
    if (spec.startsWith('../')) {
      problems.push(`상대경로: ${rel} → ${spec}`)
      continue
    }
    if (!spec.startsWith('@/')) continue

    const [depLayer, depSlice, ...rest] = spec.slice(2).split('/')
    const here = ORDER.indexOf(layer)
    const there = ORDER.indexOf(depLayer)
    if (here === -1 || there === -1) continue

    // 단방향: 하위(인덱스 큼)가 상위(인덱스 작음)를 부르면 위반
    if (there < here) {
      problems.push(`단방향 위반: ${layer} → ${depLayer}  (${rel} → ${spec})`)
      continue
    }
    // 같은 레이어의 다른 슬라이스도 부르지 않는다(횡단 금지)
    if (there === here && depSlice !== slice) {
      problems.push(`같은 레이어 횡단: ${rel} → ${spec}`)
      continue
    }
    /*
     * 다른 슬라이스의 내부 파일을 직접 부르면 위반 (index.ts 로만).
     *
     * ⚠️ CSS Module 은 예외다 — `index.ts` 로 재노출할 방법이 없다
     *    (`export ... from '*.module.css'` 는 타입이 안 붙는다).
     *    그래서 공용 스타일은 파일 경로로 직접 가져온다.
     */
    if (there > here && rest.length > 0 && !spec.endsWith('.css')) {
      problems.push(`슬라이스 내부 직접 참조: ${rel} → ${spec}`)
    }
  }
}

if (problems.length) {
  process.stderr.write(`FSD 검사 — ${problems.length}건 위반\n`)
  for (const p of problems) process.stderr.write(`  ${p}\n`)
  process.exit(1)
}
process.stdout.write('FSD 검사 통과 — 단방향 의존 · 슬라이스 public API · 절대경로\n')
