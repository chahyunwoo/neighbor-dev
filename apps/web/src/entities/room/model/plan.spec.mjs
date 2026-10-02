// 2D 평면 방이 3D 와 같은 배치·같은 시점에서 나오는지 본다. 고정 좌표가 끼어들면 데이터를 흔드는 단언이 잡는다.
// 돌리는 법: node --experimental-strip-types --test apps/web/src/entities/room/model/plan.spec.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CAMERA_POSITION,
  LAYOUT,
  MONITOR_POSITION,
  ROOM_CENTER,
  ROOM_SHELL,
  WHITEBOARD_POSITION,
} from './layout.ts'
import { planPins, planShape, projectIso } from './plan.ts'
import { ROOM_OBJECTS } from './room.ts'

const SOURCE = {
  view: { eye: CAMERA_POSITION, target: ROOM_CENTER },
  layout: LAYOUT,
  fixtures: { monitor: MONITOR_POSITION, whiteboard: WHITEBOARD_POSITION },
  objects: ROOM_OBJECTS,
  shell: ROOM_SHELL,
}

/** 가장 좁게 잡은 폰 폭에서 평면 방이 차지하는 px. */
const NARROW_PX = 320
/** RoomPlan.module.css 의 .pin 지름. 핀끼리 이보다 가까우면 탭 타깃이 겹친다. */
const PIN_PX = 30

test('핀 7개가 목록과 같은 번호·링크를 가진다', () => {
  const pins = planPins(SOURCE)
  assert.deepEqual(
    pins.map((p) => [p.no, p.id, p.href]),
    ROOM_OBJECTS.map((o) => [o.no, o.id, o.href]),
  )
  assert.equal(pins.length, 7)
})

test('배치에서 핫스팟 하나가 빠지면 핀을 만들지 않는다', () => {
  const layout = LAYOUT.map((p) => (p.hotspot === 'drawer' ? { ...p, hotspot: undefined } : p))
  assert.throws(() => planPins({ ...SOURCE, layout }), /drawer/)
})

test('핀은 배치 좌표를 따라 움직인다', () => {
  const before = planPins(SOURCE).find((p) => p.id === 'laptop')
  const layout = LAYOUT.map((p) =>
    p.hotspot === 'laptop'
      ? { ...p, position: [p.position[0] + 1, p.position[1], p.position[2]] }
      : p,
  )
  const after = planPins({ ...SOURCE, layout }).find((p) => p.id === 'laptop')
  const [du, dv] = projectIso([1, 0, 0], SOURCE.view)
  assert.ok(Math.abs(after.u - before.u - du) < 1e-9)
  assert.ok(Math.abs(after.v - before.v - dv) < 1e-9)
  assert.ok(Math.hypot(du, dv) > 0.1)

  const fixtures = { ...SOURCE.fixtures, whiteboard: [0, 0, 0] }
  const wb = planPins({ ...SOURCE, fixtures }).find((p) => p.id === 'whiteboard')
  assert.deepEqual([wb.u, wb.v], [...projectIso([0, 0, 0], SOURCE.view)])
})

test('투영 방위각은 3D 기본 카메라에서 나온다', () => {
  // 카메라에서 바라보는 지점으로 가는 수평 직선 위의 점은 화면에서 한 세로줄에 선다.
  const [ex, , ez] = CAMERA_POSITION
  const [tx, , tz] = ROOM_CENTER
  const a = projectIso([ex, 0, ez], SOURCE.view)
  const b = projectIso([tx, 0, tz], SOURCE.view)
  assert.ok(Math.abs(a[0] - b[0]) < 1e-9)
  // 카메라 쪽(가까운 점)이 화면 아래다.
  assert.ok(a[1] > b[1])

  const turned = {
    eye: [-CAMERA_POSITION[0], CAMERA_POSITION[1], CAMERA_POSITION[2]],
    target: ROOM_CENTER,
  }
  const moved = planPins({ ...SOURCE, view: turned })
  assert.notDeepEqual(
    moved.map((p) => p.u),
    planPins(SOURCE).map((p) => p.u),
  )
})

test('핀이 방 안에 서고 viewBox 안에 담긴다', () => {
  const { RW, RD, FX, FZ, WH } = ROOM_SHELL
  for (const [id, p] of [
    ...LAYOUT.filter((l) => l.hotspot).map((l) => [l.hotspot, l.position]),
    ['monitor', MONITOR_POSITION],
    ['whiteboard', WHITEBOARD_POSITION],
  ]) {
    assert.ok(p[0] >= FX - RW / 2 && p[0] <= FX + RW / 2, `${id} x`)
    assert.ok(p[2] >= FZ - RD / 2 && p[2] <= FZ + RD / 2, `${id} z`)
    assert.ok(p[1] >= 0 && p[1] <= WH, `${id} y`)
  }
  const [x, y, w, h] = planShape(SOURCE).viewBox
  const k = NARROW_PX / w
  for (const p of planPins(SOURCE)) {
    // 핀 반지름만큼 안쪽이어야 가장자리에서 잘리지 않는다.
    const r = PIN_PX / 2 / k
    assert.ok(p.u - r >= x && p.u + r <= x + w, `${p.id} u`)
    assert.ok(p.v - r >= y && p.v + r <= y + h, `${p.id} v`)
  }
})

test(`${NARROW_PX}px 폭에서도 핀끼리 지름(${PIN_PX}px) 이상 떨어진다`, () => {
  const pins = planPins(SOURCE)
  const k = NARROW_PX / planShape(SOURCE).viewBox[2]
  let min = Infinity
  for (const a of pins)
    for (const b of pins) if (a.no < b.no) min = Math.min(min, Math.hypot(a.u - b.u, a.v - b.v) * k)
  assert.ok(min >= PIN_PX, `최소 간격 ${min.toFixed(1)}px`)
})
