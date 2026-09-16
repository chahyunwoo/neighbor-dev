#!/usr/bin/env node
/**
 * 쓰는 애니메이션이 **실제로 정의돼 있는가.**
 *
 * 🔴 실측 2026-09-16: `RoomPanel` 이 `animate-[panelIn_.44s_...]` 를 쓰는데
 *    `panelIn` **키프레임이 어디에도 없었다.** 브라우저는 모르는 이름을 조용히
 *    무시하므로 패널이 한 프레임에 0 → 100 으로 튀어나왔다 —
 *    `getAnimations()` 가 빈 배열이었고 `keyframesExist: false` 였다.
 *
 *    빌드도 타입체크도 lint 도 브라우저 프로브도 전부 통과했다. 이름을 잘못
 *    쓴 애니메이션은 **아무도 안 잡는다.** 사용자가 "확 나타난다" 고 지적하고
 *    나서야 찾았다.
 *
 * 무엇을 보는가:
 *   ① `animate-[NAME_...]`(Tailwind 임의값)의 NAME 이 정의돼 있는가
 *   ② `animation: NAME ...`(CSS)의 NAME 이 정의돼 있는가
 *   ③ 정의됐는데 아무도 안 쓰는 키프레임 — 지웠거나 오타다
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'apps', 'web', 'src')

/** 브라우저·Tailwind 가 기본으로 아는 이름. 정의가 없어도 된다. */
const BUILTIN = new Set(['none', 'spin', 'ping', 'pulse', 'bounce'])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(tsx?|css)$/.test(name)) out.push(p)
  }
  return out
}

const files = walk(SRC)

/** 정의된 키프레임 이름. */
const defined = new Set()
/** 쓰는 이름 → 어디서 쓰는가. */
const used = new Map()

const note = (name, where) => {
  if (BUILTIN.has(name)) return
  if (!used.has(name)) used.set(name, [])
  used.get(name)?.push(where)
}

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const rel = file.slice(ROOT.length + 1)

  for (const m of src.matchAll(/@keyframes\s+([\w-]+)/g)) defined.add(m[1])

  // Tailwind 임의값: animate-[panelIn_.44s_...]
  for (const m of src.matchAll(/animate-\[([A-Za-z_][\w-]*)[_\]]/g)) note(m[1], rel)

  /*
   * CSS 단축 속성: `animation: 300ms ease both vt-out;`
   * 이름이 앞에 올 수도 뒤에 올 수도 있어 토큰을 훑는다. 시간·곡선·키워드를
   * 걸러낸 나머지가 이름이다.
   */
  for (const m of src.matchAll(/animation:\s*([^;{}]+);/g)) {
    const value = m[1]
    if (value.includes('var(')) continue // 변수로 넘기는 경우는 못 본다
    for (const token of value.split(/\s+/)) {
      const t = token.trim()
      if (!t) continue
      if (/^[\d.]+m?s$/.test(t)) continue // 시간
      if (/^(both|forwards|backwards|infinite|alternate|reverse|normal|paused|running)$/.test(t))
        continue
      if (/^(linear|ease|ease-in|ease-out|ease-in-out|steps?)\b/.test(t)) continue
      if (t.startsWith('cubic-bezier') || t.includes('(')) continue
      if (/^\d/.test(t)) continue // 반복 횟수
      if (/^[A-Za-z_][\w-]*$/.test(t)) note(t, rel)
    }
  }

  // `animation-name: x`
  for (const m of src.matchAll(/animation-name:\s*([\w-]+)/g)) note(m[1], rel)
}

const missing = [...used.entries()].filter(([name]) => !defined.has(name))
const unused = [...defined].filter((name) => !used.has(name))

if (missing.length === 0 && unused.length === 0) {
  process.stdout.write(
    `애니메이션 검사 통과 — 쓰는 ${used.size}개가 전부 정의돼 있다 (키프레임 ${defined.size}개)\n`,
  )
  process.exit(0)
}

if (missing.length) {
  process.stderr.write(`🔴 정의가 없는 애니메이션 ${missing.length}개 — 조용히 무시된다\n`)
  for (const [name, where] of missing) {
    process.stderr.write(`  · ${name}  ← ${[...new Set(where)].join(', ')}\n`)
  }
}
if (unused.length) {
  process.stderr.write(`⚠️ 아무도 안 쓰는 키프레임 ${unused.length}개 — 오타이거나 죽은 코드다\n`)
  for (const name of unused) process.stderr.write(`  · ${name}\n`)
}
process.exit(1)
