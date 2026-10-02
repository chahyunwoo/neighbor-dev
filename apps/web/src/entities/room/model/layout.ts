// 프로토타입 실측값이다. 눈대중으로 고치지 않는다 — Kenney 모델 원점이 min 코너라 감으로 옮기면 바닥에 박히거나 뜬다.
// 모델이 실제 크기의 절반이라 S=2.05 로 키운다.
export const DEG = Math.PI / 180

export const S = 2.05

/** 책상 상판 높이. 위에 올리는 물건은 이 y 를 쓴다. */
export const DESK_TOP = 0.787

export interface Placement {
  /** public/models/<model>.glb */
  model: string
  position: [number, number, number]
  /** 도 단위. */
  rotationY: number
  scale: number | [number, number, number]
  /** 클릭 지점이면 그 id(RoomObject.id). */
  hotspot?: string
}

export const LAYOUT: readonly Placement[] = [
  // 책상 구역 — 뒷벽 앞, 중심선 x=-0.30
  { model: 'desk', position: [-0.3, 0, 2.15], rotationY: 180, scale: [S * 1.75, S, S] },
  { model: 'computerKeyboard', position: [-1.43, DESK_TOP, 2.26], rotationY: 180, scale: S },
  { model: 'computerMouse', position: [-1.05, DESK_TOP, 2.28], rotationY: 180, scale: S },
  {
    model: 'laptop',
    position: [-0.44, DESK_TOP, 2.34],
    rotationY: 158,
    scale: S * 0.78,
    hotspot: 'laptop',
  },
  { model: 'lampSquareTable', position: [-2.65, DESK_TOP, 2.62], rotationY: 196, scale: S * 0.9 },
  { model: 'chairDesk', position: [-1.79, 0, 1.96], rotationY: 0, scale: S },
  { model: 'rugRounded', position: [-3.05, 0.004, 2.9], rotationY: 0, scale: S * 0.95 },

  {
    model: 'bookcaseOpen',
    position: [-2.53, 0, 2.11],
    rotationY: 90,
    scale: S,
    hotspot: 'bookshelf',
  },
  {
    model: 'sideTableDrawers',
    position: [-2.61, 0, 0.07],
    rotationY: 90,
    scale: S,
    hotspot: 'drawer',
  },
  { model: 'lampSquareFloor', position: [-2.85, 0, 0.75], rotationY: 16, scale: S },
  // 문틀 두께 가운데를 왼쪽 벽 가운데(x -3.1)에 맞춘다.
  { model: 'doorway', position: [-3.0085, 0, -1.1], rotationY: 90, scale: S, hotspot: 'door' },

  // 뒷벽 창 — 바닥에 서는 벽 패널이다(유리는 y1.11~2.47)
  { model: 'wallWindow', position: [1.27, 0, 3.32], rotationY: 0, scale: S },
  { model: 'pottedPlant', position: [3.08, 0, 2.65], rotationY: 0, scale: S },
  { model: 'trashcan', position: [0.57, 0, 2.75], rotationY: 0, scale: S * 0.85 },

  { model: 'table', position: [0.33, 0, 0.21], rotationY: 0, scale: S, hotspot: 'team' },
  { model: 'rugRound', position: [0.21, 0.004, 0.74], rotationY: 0, scale: S * 1.05 },
  { model: 'chairRounded', position: [0.98, 0, 0.37], rotationY: 180, scale: S },
  { model: 'chairRounded', position: [1.82, 0, 0.37], rotationY: 180, scale: S },
  { model: 'chairRounded', position: [0.57, 0, -0.87], rotationY: 0, scale: S },
  { model: 'chairRounded', position: [1.41, 0, -0.87], rotationY: 0, scale: S },
] as const

// 방 껍데기 치수. 프로토타입 실측값이라 눈대중으로 고치지 않는다.
/** RW=폭, RD=깊이, WH=벽 높이, (FX,FZ)=바닥 중심. DOOR_*=왼쪽 벽 문 자리(문 모델 경계와 같다 — 크면 문 둘레 틈으로 배경이 보인다). */
export const ROOM_SHELL = {
  RW: 6.8,
  RD: 5.6,
  WH: 3.0,
  FX: 0.3,
  FZ: 0.55,
  DOOR_Z0: -2.096,
  DOOR_Z1: -1.1,
  DOOR_H: 2.07,
} as const

// 프로토타입 실측값이다. 눈대중으로 바꾸지 않는다 — 화이트보드는 왼쪽 벽이 아니라 뒷벽에 건다.
export const MONITOR_POSITION: [number, number, number] = [-1.79, DESK_TOP, 2.62]
export const WHITEBOARD_POSITION: [number, number, number] = [-1.78, 1.9, 3.26]
export const WHITEBOARD_ROTATION_Y = 0

// 방을 보는 기본 시점 — 3D 카메라와 2D 평면도가 같은 쪽에서 본다. 프로토타입 실측값. z 는 음수다 — 반대편에서 보면 책장이 카메라를 막는다.
export const CAMERA_POSITION: [number, number, number] = [7.2, 5.0, -3.6]
export const ROOM_CENTER: [number, number, number] = [0.25, 0.85, 1.1]
