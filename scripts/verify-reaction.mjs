#!/usr/bin/env node
// 가구가 벽이나 서로를 파고드는지 잰다 — 놓인 상태와 열리는 반응 모션 둘 다, 새로 파고든 깊이만(경로 중간 포함).
// 돌리는 법: node --experimental-strip-types scripts/verify-reaction.mjs

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(ROOT, 'apps/web')
const req = createRequire(join(WEB, 'package.json'))
const THREE = await import(pathToFileURL(req.resolve('three')).href)
const { GLTFLoader } = await import(
  pathToFileURL(join(dirname(req.resolve('three')), '../examples/jsm/loaders/GLTFLoader.js')).href
)
const { LAYOUT, DEG } = await import(join(WEB, 'src/entities/room/model/layout.ts'))
const { reactionOf, poseAt } = await import(join(WEB, 'src/features/room-3d/scene/reaction.ts'))

// 벽 안쪽 면 — ROOM_SHELL 의 RW·RD·FX·FZ 와 두께 0.12 에서 나온다
const WALL_LEFT_X = 0.3 - 6.8 / 2 + 0.06
const WALL_BACK_Z = 0.55 + 5.6 / 2 - 0.06
// 새로 파고든 깊이(m) 허용치 — 접촉면 부동소수 오차보다 크고 눈에 띄는 관통보다 작다
const TOLERANCE = 0.01
const STEPS = [0.25, 0.5, 0.75, 1]
// 바닥에 까는 것은 위에 다른 물건이 올라서는 게 정상
const FLAT = new Set(['rugRounded', 'rugRound'])

const loader = new GLTFLoader()
const cache = new Map()
async function load(model) {
  if (!cache.has(model)) {
    const buf = readFileSync(join(WEB, 'public/models', `${model}.glb`))
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    cache.set(model, await new Promise((ok, no) => loader.parse(ab, '', (g) => ok(g.scene), no)))
  }
  return cache.get(model)
}

function scaleOf(p) {
  return Array.isArray(p.scale) ? p.scale : [p.scale, p.scale, p.scale]
}

// 노드 변환 포함, 배치 변환 전
function localVertices(scene) {
  scene.updateMatrixWorld(true)
  const out = []
  const v = new THREE.Vector3()
  scene.traverse((o) => {
    if (!o.isMesh) return
    const pos = o.geometry.attributes.position
    for (let i = 0; i < pos.count; i++)
      out.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone())
  })
  return out
}

const items = []
for (const p of LAYOUT) {
  const local = localVertices(await load(p.model))
  const s = scaleOf(p)
  const box = new THREE.Box3().setFromPoints(local)
  const c = box.getCenter(new THREE.Vector3())
  items.push({ p, local, s, center: [c.x * s[0], c.y * s[1], c.z * s[2]] })
}

// 월드 정점과 스케일 뺀 배치 좌표계를 낸다
function place(item, pose) {
  const frame = new THREE.Matrix4().compose(
    new THREE.Vector3(...pose.position),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw),
    new THREE.Vector3(1, 1, 1),
  )
  const scaled = item.local.map(
    (v) => new THREE.Vector3(v.x * item.s[0], v.y * item.s[1], v.z * item.s[2]),
  )
  const world = scaled.map((v) => v.clone().applyMatrix4(frame))
  const box = new THREE.Box3().setFromPoints(scaled)
  return { world, inv: frame.clone().invert(), box }
}

function restPose(item) {
  return { position: item.p.position, yaw: item.p.rotationY * DEG }
}

// 벽 안에 끼워 넣는 것이 정상인 모델 — 놓인 상태만 면제한다. 여는 동안 더 파고드는 것은 잰다
const IN_WALL = new Set(['doorway', 'wallWindow'])

const vertexWallDepths = (placed) =>
  placed.world.map((v) => Math.max(0, WALL_LEFT_X - v.x, v.z - WALL_BACK_Z))

function wallDepth(item, placed) {
  return IN_WALL.has(item.p.model) ? 0 : Math.max(0, ...vertexWallDepths(placed))
}

// 같은 정점끼리 비교해 새로 파고든 깊이만 낸다 — 이미 벽에 박힌 문틀의 최대 깊이에 여닫이 관통이 가려지지 않게
function addedWallDepth(before, after) {
  let d = 0
  for (const [k, a] of after.entries()) d = Math.max(d, a - before[k])
  return d
}

function overlapDepth(a, b) {
  let d = 0
  const v = new THREE.Vector3()
  const { min, max } = b.box
  for (const w of a.world) {
    v.copy(w).applyMatrix4(b.inv)
    const inside = Math.min(
      v.x - min.x,
      max.x - v.x,
      v.y - min.y,
      max.y - v.y,
      v.z - min.z,
      max.z - v.z,
    )
    if (inside > d) d = inside
  }
  return d
}

const rest = items.map((it) => place(it, restPose(it)))
const problems = []
const report = []

for (const [i, it] of items.entries()) {
  const w = wallDepth(it, rest[i])
  if (w > TOLERANCE) problems.push(`${it.p.model} 가 놓인 채로 벽을 ${w.toFixed(3)}m 파고든다`)
  for (let j = i + 1; j < items.length; j++) {
    if (FLAT.has(it.p.model) || FLAT.has(items[j].p.model)) continue
    const d = Math.max(overlapDepth(rest[i], rest[j]), overlapDepth(rest[j], rest[i]))
    if (d > TOLERANCE)
      problems.push(`${it.p.model} 와 ${items[j].p.model} 가 놓인 채로 ${d.toFixed(3)}m 겹친다`)
  }
}

for (const [i, it] of items.entries()) {
  if (!it.p.hotspot) continue
  const r = reactionOf(it.p.hotspot)
  let wall = 0
  const pair = new Map()
  const restWall = vertexWallDepths(rest[i])
  for (const t of STEPS) {
    const moved = place(it, poseAt(restPose(it), r, t, it.center))
    wall = Math.max(wall, addedWallDepth(restWall, vertexWallDepths(moved)))
    for (const [j, other] of items.entries()) {
      if (i === j || FLAT.has(other.p.model) || FLAT.has(it.p.model)) continue
      const before = Math.max(overlapDepth(rest[i], rest[j]), overlapDepth(rest[j], rest[i]))
      const after = Math.max(overlapDepth(moved, rest[j]), overlapDepth(rest[j], moved))
      pair.set(other.p.model, Math.max(pair.get(other.p.model) ?? 0, after - before))
    }
  }
  const worst = [...pair].sort((a, b) => b[1] - a[1])[0] ?? ['-', 0]
  report.push(
    `  ${it.p.hotspot.padEnd(10)} 벽 ${wall.toFixed(3)}m · 가구 ${worst[1].toFixed(3)}m (${worst[0]})`,
  )
  if (wall > TOLERANCE)
    problems.push(`'${it.p.hotspot}' 가 열리며 벽을 ${wall.toFixed(3)}m 파고든다`)
  for (const [model, d] of pair)
    if (d > TOLERANCE)
      problems.push(`'${it.p.hotspot}' 가 열리며 ${model} 을 ${d.toFixed(3)}m 파고든다`)
}

process.stdout.write(`반응 관통 검사 (허용 ${TOLERANCE}m)\n${report.join('\n')}\n`)
if (problems.length) {
  for (const p of problems) process.stderr.write(`  🔴 ${p}\n`)
  process.exit(1)
}
process.stdout.write('통과 — 놓인 상태도, 여는 동안에도 파고드는 것이 없다\n')
