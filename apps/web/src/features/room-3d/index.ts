/**
 * 작업실 3D — 슬라이스 public API.
 *
 * ⚠️ 서버 리소스가 없다. 물건 데이터는 `entities/room` 이 쥐고 있고
 *    이 슬라이스는 **그것을 3D 로 그리는 표현 계층**이다 — 그래서 `features` 다.
 *
 * 🔴 캔버스는 앱 전체에 하나뿐이다(`CanvasRoot` 를 `app/layout.tsx` 가 마운트).
 *    각 화면은 `CanvasMode`·`ObjectStage`·`Room` 으로 자기 모드를 선언한다.
 */
export { CanvasMode, type Mode } from './canvas/CanvasMode'
export { CanvasRoot } from './canvas/CanvasRoot'
export { ContentWidth } from './canvas/ContentWidth'
export { ObjectStage } from './scene/ObjectStage'
export { Room } from './scene/Room'
export { RoomPanel } from './scene/RoomPanel'
