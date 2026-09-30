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
  /** 클릭 지점이면 그 id(entities/room 의 RoomObject.id). */
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

// 팩은 텍스처가 없고 색이 baseColorFactor 라 머티리얼 이름으로 리컬러한다. 화면 패널은 glass 가 아니라 metalDark 슬롯이다.
export const PALETTE: Record<string, number> = {
  wood: 0x463126,
  woodDark: 0x2e2018,
  metal: 0x596171,
  metalDark: 0x2b2f38,
  metalMedium: 0x474e5c,
  metalLight: 0x757e90,
  carpet: 0x3a342c,
  carpetWhite: 0x51483d,
  carpetBlue: 0x33455f,
  carpetDarker: 0x2e2a25,
  glass: 0x1b2c4a,
  lamp: 0xf0c08a,
  plant: 0x3e6b47,
  fur: 0x3a3229,
  // 이름 없는 슬롯(sideTableDrawers, wallWindow).
  _defaultMat: 0x3a3a44,
}

/** 머티리얼별 metalness. 없으면 0. */
export const METALNESS: Record<string, number> = {
  metal: 0.8,
  metalLight: 0.85,
  metalDark: 0.45,
  metalMedium: 0.68,
}

// 프로토타입 실측값. 눈대중으로 올리지 않는다 — 거칠기를 올리면 방이 통째로 어두워진다.
export const ROUGHNESS: Record<string, number> = {
  metal: 0.38,
  metalLight: 0.3,
  metalDark: 0.55,
  glass: 0.1,
  wood: 0.72,
  woodDark: 0.78,
  carpet: 0.96,
  carpetWhite: 0.95,
  carpetBlue: 0.94,
  carpetDarker: 0.96,
  plant: 0.85,
  fur: 0.88,
  lamp: 0.4,
}

export const DEFAULTS = { color: 0x1b1a21, roughness: 0.6, metalness: 0.05 } as const

// 방 전체를 볼 때와 물건에 다가갈 때 허용 범위가 달라야 한다 — 같으면 다가가지 못하거나 방을 뚫는다.
export const CAMERA_LIMITS = {
  minDistance: 4.6,
  maxDistance: 12,
  minPolarAngle: Math.PI * 0.17,
  maxPolarAngle: Math.PI * 0.46,
  minAzimuthAngle: Math.PI * 0.54,
  maxAzimuthAngle: Math.PI * 0.98,
} as const

export const CAMERA_LIMITS_FOCUS = {
  minDistance: 1.2,
  maxDistance: 6.5,
  minPolarAngle: Math.PI * 0.14,
  maxPolarAngle: Math.PI * 0.52,
  minAzimuthAngle: Math.PI * 0.44,
  maxAzimuthAngle: Math.PI * 1.08,
} as const

// 프로토타입 실측값. z 는 음수다 — 반대편에서 보면 책장이 카메라를 막는다.
export const CAMERA_POSITION: [number, number, number] = [7.2, 5.0, -3.6]
export const CAMERA_FOV = 37

export const ROOM_CENTER: [number, number, number] = [0.25, 0.85, 1.1]

// 벽에 붙은 물건은 초점을 방 중심 쪽으로 당긴다 — 그대로 두면 카메라가 벽을 향해 물건이 화면을 덮는다. 값은 후보 렌더 비교로 정한다.
export const FOCUS_PULL: Record<string, number> = {
  // 0 은 문이 화면을 덮고, 2.4 는 문이 가장자리로 밀린다.
  door: 1.6,
}
