// 투영 보정 트윈 검증. 재목표가 겹쳐도 한 프레임에 튀지 않고, 라우트 전환에선 프레임 시계와 같은 곡선을 타는지 본다.
// 돌리는 법: node --experimental-strip-types --test apps/web/src/features/room-3d/model/tween.spec.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ease, FRAME_MS, stepShift } from './tween.ts'

const DT = 16

// events: { at, target?, frame? } — 그 시각부터 목표·프레임 시계를 바꾼다. 프레임별 값을 돌려준다.
function run(initial, events, until) {
  let value = initial
  let tween = null
  let target = initial
  let frame = null
  let seen = null
  const out = []
  for (let now = 0; now <= until; now += DT) {
    for (const e of events.filter((e) => e.at === now)) {
      if ('target' in e) target = e.target
      if ('frame' in e) frame = e.frame
    }
    const next = stepShift(now, value, tween, target, frame, frame !== seen)
    seen = frame
    value = next.value
    tween = next.tween
    out.push({ now, value, tween })
  }
  return out
}

// 새로 시작한 FRAME_MS 트윈이 한 프레임에 갈 수 있는 최대 거리 — ease 기울기 최대값이 3 이다
const bound = (dist, ms = FRAME_MS) => (Math.abs(dist) * 3 * DT) / ms + 0.5

const maxStep = (out) => {
  let mx = 0
  for (let i = 1; i < out.length; i++) mx = Math.max(mx, Math.abs(out[i].value - out[i - 1].value))
  return mx
}

test('패널을 열다가 닫아도 한 프레임에 튀지 않는다', () => {
  const out = run(
    260,
    [
      { at: 0, target: -220 },
      { at: 224, target: 260 },
    ],
    900,
  )
  assert.ok(maxStep(out) <= bound(480), `최대 ${maxStep(out).toFixed(1)}px`)
  assert.equal(out.at(-1).value, 260)
})

test('홈 복귀 트윈이 끝나기 전에 패널을 열어도 튀지 않는다', () => {
  const frame = { start: 0, ms: FRAME_MS }
  const out = run(
    -172,
    [
      { at: 0, frame, target: 229 },
      { at: 288, target: -172 },
      { at: 448, frame: null },
    ],
    1000,
  )
  assert.ok(maxStep(out) <= bound(401), `최대 ${maxStep(out).toFixed(1)}px`)
  assert.equal(out.at(-1).value, -172)
})

test('라우트 전환에선 프레임 시계와 같은 곡선으로 같이 착지한다', () => {
  const frame = { start: 0, ms: FRAME_MS }
  const out = run(
    260,
    [
      { at: 0, frame, target: 100 },
      { at: 16, target: 40 },
      { at: 448, frame: null },
    ],
    600,
  )
  assert.equal(out[0].value, 260 + (100 - 260) * ease(0))
  const second = out.find((s) => s.now === 16).tween
  assert.equal(second.start + second.ms, 440)
  assert.equal(out.find((s) => s.now === 448).value, 40)
  assert.ok(maxStep(out) <= bound(220), `최대 ${maxStep(out).toFixed(1)}px`)
})

test('목표가 그대로면 값도 그대로다', () => {
  const out = run(120, [], 200)
  assert.ok(out.every((s) => s.value === 120 && s.tween === null))
})
