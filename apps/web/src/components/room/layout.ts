/**
 * 작업실 배치 — 프로토타입(.wip/room2.html)에서 실측으로 얻은 값을 그대로 옮겼다.
 *
 * ⚠️ **눈대중으로 고치지 않는다.** 이 좌표들은 전부
 *    "원하는 중심 − 실측 크기/2" 로 역산한 값이다. Kenney 모델의 원점이
 *    중심이 아니라 min 코너라서, 감으로 옮기면 바닥에 박히거나 뜬다.
 *
 * ⚠️ 모델이 실제 크기의 절반이다(책상 0.73m, 문 1.01m). S=2.05 로 키운다.
 */

/** 전역 스케일. 실측: Kenney 모델이 실제 크기의 약 절반이다. */
/** 도 → 라디안. 배치는 도로 적고 three 는 라디안을 쓴다. */
export const DEG = Math.PI / 180

export const S = 2.05

/** 책상 상판 높이. 위에 올리는 물건은 이 y 를 쓴다. */
export const DESK_TOP = 0.787

export interface Placement {
  /** public/models/<model>.glb */
  model: string
  position: [number, number, number]
  /** Y축 회전(도). */
  rotationY: number
  /** 균등 스케일이거나 [x,y,z]. */
  scale: number | [number, number, number]
  /** 클릭 지점이면 그 id (lib/room.ts 의 RoomObject.id 와 같다). */
  hotspot?: string
}

export const LAYOUT: readonly Placement[] = [
  // ===== 책상 구역 — 뒷벽(z=3.29) 앞, 중심선 x=-0.30 에 정렬 =====
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

  // ===== 왼쪽 벽면 =====
  {
    model: 'bookcaseOpen',
    position: [-2.59, 0, 2.19],
    rotationY: 90,
    scale: S,
    hotspot: 'bookshelf',
  },
  {
    model: 'sideTableDrawers',
    position: [-2.67, 0, 0.07],
    rotationY: 90,
    scale: S,
    hotspot: 'drawer',
  },
  { model: 'lampSquareFloor', position: [-2.85, 0, 0.75], rotationY: 16, scale: S },
  { model: 'doorway', position: [-2.89, 0, -1.1], rotationY: 90, scale: S, hotspot: 'door' },

  // ===== 뒷벽 창 — 바닥에 서는 벽 패널이다(유리는 y1.11~2.47) =====
  { model: 'wallWindow', position: [1.27, 0, 3.32], rotationY: 0, scale: S },
  { model: 'pottedPlant', position: [3.08, 0, 2.65], rotationY: 0, scale: S },
  { model: 'trashcan', position: [0.57, 0, 2.75], rotationY: 0, scale: S * 0.85 },

  // ===== 회의 구역 — 방 오른쪽 앞 =====
  { model: 'table', position: [0.33, 0, 0.21], rotationY: 0, scale: S, hotspot: 'team' },
  { model: 'rugRound', position: [0.21, 0.004, 0.74], rotationY: 0, scale: S * 1.05 },
  { model: 'chairRounded', position: [0.98, 0, 0.37], rotationY: 180, scale: S },
  { model: 'chairRounded', position: [1.82, 0, 0.37], rotationY: 180, scale: S },
  { model: 'chairRounded', position: [0.57, 0, -0.87], rotationY: 0, scale: S },
  { model: 'chairRounded', position: [1.41, 0, -0.87], rotationY: 0, scale: S },
] as const

/**
 * 다크 리컬러 팔레트.
 *
 * 🔑 이 팩을 고른 결정적 이유가 여기 있다 — 텍스처가 **0개**이고 색이 전부
 *    `baseColorFactor` 숫자값이라, 머티리얼 이름만으로 팩 전체를 리컬러할 수 있다.
 *    실측(Blender): 머티리얼 36개가 한 번에 바뀌었다.
 *
 * ⚠️ 화면 패널은 `glass` 가 아니라 `metalDark` 슬롯이다 — `glass` 로 찾으면 0개가 잡힌다.
 */
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
  // 이름 없는 슬롯. 실측으로 2개 있다(sideTableDrawers, wallWindow).
  _defaultMat: 0x3a3a44,
}

/** 머티리얼별 metalness. 없으면 0. */
export const METALNESS: Record<string, number> = {
  metal: 0.8,
  metalLight: 0.85,
  metalDark: 0.45,
  metalMedium: 0.68,
}

/**
 * 머티리얼별 roughness. **프로토타입 실측값 그대로.**
 *
 * ⚠️ 눈대중으로 올리지 않는다. 기본값을 0.9 로 두고 wood 를 0.82 로 뒀더니
 *    빛을 거의 반사하지 않아 방이 통째로 어두웠다(실측 2026-09-09:
 *    프로토타입 대비 화면 평균 밝기가 절반이었다).
 */
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

/** 팔레트·거칠기·금속도에 없는 이름의 기본값. 프로토타입과 같다. */
export const DEFAULTS = { color: 0x1b1a21, roughness: 0.6, metalness: 0.05 } as const

/**
 * 카메라 제한 — 프로토타입 실측값(시안 `LIMITS`).
 *
 * 🔴 **상태마다 다르다.** 방 전체를 볼 때와 물건 하나에 다가갔을 때 허용 범위가
 *    같으면 안 된다 — overview 의 `minDistance: 4.6` 을 그대로 두면 물건에
 *    다가갈 수 없고, focus 의 `1.2` 를 늘 쓰면 방을 뚫고 들어간다.
 */
export const CAMERA_LIMITS = {
  minDistance: 4.6,
  maxDistance: 12,
  minPolarAngle: Math.PI * 0.17,
  maxPolarAngle: Math.PI * 0.46,
  minAzimuthAngle: Math.PI * 0.54,
  maxAzimuthAngle: Math.PI * 0.98,
} as const

/** 물건 하나를 보고 있을 때. 시안 `LIMITS.focus`. */
export const CAMERA_LIMITS_FOCUS = {
  minDistance: 1.2,
  maxDistance: 6.5,
  minPolarAngle: Math.PI * 0.14,
  maxPolarAngle: Math.PI * 0.52,
  minAzimuthAngle: Math.PI * 0.44,
  maxAzimuthAngle: Math.PI * 1.08,
} as const

/**
 * 카메라 초기 구도 — 프로토타입 실측값 그대로.
 *
 * ⚠️ **눈대중으로 정하지 않는다.** 처음에 임의로 `[5.2, 4.1, 6.4]` 를 넣었더니
 *    방을 반대편(z 양수)에서 보게 되어 책장이 카메라를 막고 모니터가 카피 뒤로
 *    숨었다(실측 2026-09-09, 스크린샷으로 확인). z 는 **음수**다.
 */
export const CAMERA_POSITION: [number, number, number] = [7.2, 5.0, -3.6]
export const CAMERA_FOV = 37

/** 방 중심 — 카메라가 바라보는 지점. */
export const ROOM_CENTER: [number, number, number] = [0.25, 0.85, 1.1]
