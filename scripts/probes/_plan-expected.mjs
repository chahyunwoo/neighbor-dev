// 평면 방 핀이 서야 할 자리를 정본 배치에서 계산해 JSON 으로 낸다. RoomPlan 조립부가 고정값을 끼우면 프로브가 어긋남을 잡는다.
// 돌리는 법: node --experimental-strip-types --no-warnings scripts/probes/_plan-expected.mjs
import {
  CAMERA_POSITION,
  LAYOUT,
  MONITOR_POSITION,
  ROOM_CENTER,
  ROOM_SHELL,
  WHITEBOARD_POSITION,
} from '../../apps/web/src/entities/room/model/layout.ts'
import { planPins, planShape } from '../../apps/web/src/entities/room/model/plan.ts'
import { ROOM_OBJECTS } from '../../apps/web/src/entities/room/model/room.ts'

const SOURCE = {
  view: { eye: CAMERA_POSITION, target: ROOM_CENTER },
  layout: LAYOUT,
  fixtures: { monitor: MONITOR_POSITION, whiteboard: WHITEBOARD_POSITION },
  objects: ROOM_OBJECTS,
  shell: ROOM_SHELL,
}

const [x, y, w, h] = planShape(SOURCE).viewBox
const pins = planPins(SOURCE).map((p) => ({
  no: String(p.no),
  fx: (p.u - x) / w,
  fy: (p.v - y) / h,
}))
process.stdout.write(JSON.stringify({ ratio: w / h, pins }))
