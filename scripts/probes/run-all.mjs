// 정적 검사기로 못 잡는 브라우저 프로브 전체 실행. api·web 이 떠 있어야 한다(안 뜨면 /contact 오류 화면을 정상으로 착각한다).
//   pnpm --filter @neighbor/api build && API_PORT=21201 node apps/api/dist/main.js &
//   pnpm --filter @neighbor/web build && PORT=21200 pnpm --filter @neighbor/web start &
//   node scripts/probes/run-all.mjs
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const DIR = 'scripts/probes'
// 판정을 사람이 하는 것(촬영만) — 자동 실행에서 뺀다
const MANUAL = new Set(['verify-each-object.cjs'])

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.cjs') && f !== '_pw.cjs' && !MANUAL.has(f))
  .sort()

let fail = 0
for (const f of files) {
  process.stdout.write(`${f.replace('.cjs', '').padEnd(22)}`)
  try {
    const out = execFileSync('node', [`${DIR}/${f}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    process.stdout.write(`${(out.trim().split('\n').at(-1) ?? 'ok').trim()}\n`)
  } catch (e) {
    fail++
    const tail = String(e.stdout ?? '')
      .trim()
      .split('\n')
      .slice(-3)
      .join('\n   ')
    process.stdout.write(`❌ 실패\n   ${tail}\n`)
  }
}

process.stdout.write(
  fail
    ? `\n${files.length}종 중 ${fail}종 실패\n`
    : `\n${files.length}종 전부 통과 (수동 확인: ${[...MANUAL].join(', ')})\n`,
)
process.exit(fail ? 1 : 0)
