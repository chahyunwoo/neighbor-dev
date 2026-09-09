/**
 * 방의 물건 — 슬라이스 public API.
 *
 * 🔴 이 목록이 3D(데스크톱)·목록(모바일)·서버 렌더 HTML(크롤러) **세 경로의
 *    같은 데이터 소스**다. 3D 는 표현 계층일 뿐이므로 데이터는 여기 있다.
 */
export { type Accent, OBJECT_MODEL, ROOM_OBJECTS, type RoomObject } from './model/room'
export { RoomList } from './ui/RoomList'
export { RoomSteps } from './ui/RoomSteps'
