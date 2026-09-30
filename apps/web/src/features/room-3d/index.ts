// 캔버스·씬은 앱 전체에 하나씩 — 화면은 RoomStage 로 모드만 선언한다(씬을 화면에 두면 전환마다 멈춘다).
export { CanvasRoot } from './canvas/CanvasRoot'
export { ContentWidth } from './canvas/ContentWidth'
export { RoomStage } from './canvas/RoomStage'
export { type RoomMode, RoomProvider, useRoom } from './model/room-state'
export { RoomPanel } from './scene/RoomPanel'
