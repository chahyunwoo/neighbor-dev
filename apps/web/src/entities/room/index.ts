// 엔드포인트는 없지만 entities 다 — 3D·목록·서버 HTML 세 경로가 쓰는 도메인 데이터다.
export {
  CAMERA_POSITION,
  DEG,
  DESK_TOP,
  LAYOUT,
  MONITOR_POSITION,
  type Placement,
  ROOM_CENTER,
  ROOM_SHELL,
  S,
  WHITEBOARD_POSITION,
  WHITEBOARD_ROTATION_Y,
} from './model/layout'
export { type Accent, OBJECT_MODEL, ROOM_OBJECTS, type RoomObject } from './model/room'
export { RoomList } from './ui/RoomList'
export { RoomPlan } from './ui/RoomPlan'
export { RoomSteps } from './ui/RoomSteps'
