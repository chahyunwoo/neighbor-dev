/**
 * 작업실 3D — 슬라이스 public API.
 *
 * ⚠️ 서버 리소스가 없다. 물건 데이터는 `entities/room` 이 쥐고 있고
 *    이 슬라이스는 **그것을 3D 로 그리는 표현 계층**이다 — 그래서 `features` 다.
 *
 * 🔴 **캔버스도 씬도 앱 전체에 하나씩이다**(`CanvasRoot` 를 `app/layout.tsx` 가
 *    마운트한다). 각 화면은 `RoomStage` 로 **모드만 선언**하고 3D 를 직접
 *    그리지 않는다 — 씬을 화면 안에 두면 라우트가 바뀔 때마다 죽고 다시 살아
 *    전환마다 91ms 멈춤이 생긴다(실측 2026-09-16, 3회 재현).
 */
export { CanvasRoot } from './canvas/CanvasRoot'
export { ContentWidth } from './canvas/ContentWidth'
export { RoomStage } from './canvas/RoomStage'
export { type RoomMode, RoomProvider, useRoom } from './model/room-state'
export { RoomPanel } from './scene/RoomPanel'
