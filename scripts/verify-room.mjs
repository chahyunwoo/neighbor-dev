#!/usr/bin/env node
/**
 * 방의 세 경로가 같은 데이터를 쓰는지 검사한다 (기획서 4절).
 *
 * 🔴 3D 마커 · 목록 폴백 · 서버 렌더 HTML 은 **같은 데이터 소스**여야 한다.
 *    Scene.tsx 는 짝을 못 찾은 핫스팟을 조용히 건너뛰므로, 어긋나면
 *    화면에서 마커 하나가 그냥 사라진다 — 에러도 경고도 없이.
 *    그 침묵을 이 검사가 깬다.
 *
 * 돌리는 법:  node scripts/verify-room.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(ROOT, 'apps/web/src')

/** 소스에서 문자열 배열을 뽑는다. 파서를 들이지 않고 정규식으로 센다. */
function extract(file, pattern) {
  const src = readFileSync(join(WEB, file), 'utf8')
  return [...src.matchAll(pattern)].map((m) => m[1])
}

// entities/room/model/room.ts 의 id (목록·서버 렌더가 쓰는 정본)
const roomIds = extract('entities/room/model/room.ts', /^\s+id:\s*'([\w-]+)',/gm)

// 3D 가 그리는 핫스팟: LAYOUT 의 hotspot + Scene 이 직접 더하는 고정물
const layoutHotspots = extract('features/room-3d/scene/layout.ts', /hotspot:\s*'([\w-]+)'/g)
const sceneAnchors = extract('features/room-3d/scene/Scene.tsx', /\{\s*id:\s*'([\w-]+)',\s*at:/g)
const drawn = [...layoutHotspots, ...sceneAnchors]

const problems = []

// 1. 정본에 없는 것을 그리려 하는가 → 마커가 조용히 사라진다
for (const id of drawn) {
  if (!roomIds.includes(id)) {
    problems.push(`3D 가 '${id}' 를 그리려 하는데 entities/room 에 없다 — 마커가 조용히 사라진다`)
  }
}

// 2. 정본에 있는데 3D 에 없는가 → 데스크톱에서만 못 가는 곳이 생긴다
for (const id of roomIds) {
  if (!drawn.includes(id)) {
    problems.push(`entities/room 의 '${id}' 를 3D 가 그리지 않는다 — 데스크톱에서만 못 간다`)
  }
}

// 3. 같은 것을 두 번 그리는가 → 마커가 겹쳐 하나만 눌린다
const seen = new Set()
for (const id of drawn) {
  if (seen.has(id)) problems.push(`'${id}' 를 두 번 그린다 — 마커가 겹친다`)
  seen.add(id)
}

if (problems.length === 0) {
  process.stdout.write(
    `방 검사 통과 — 클릭 지점 ${roomIds.length}개가 3D·목록·서버 렌더에서 모두 일치한다\n`,
  )
} else {
  process.stderr.write(`방 검사 — ${problems.length}건 불일치\n`)
  for (const p of problems) process.stderr.write(`  🔴 ${p}\n`)
  process.exit(1)
}
