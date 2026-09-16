'use client'

import type { OrbitControls as DreiOrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { CAMERA_LIMITS, CAMERA_LIMITS_FOCUS, CAMERA_POSITION, ROOM_CENTER } from './layout'

/**
 * OrbitControls 인스턴스 타입.
 *
 * ⚠️ `three-stdlib` 에서 직접 가져오지 않는다 — drei 의 **의존성**이라
 *    이 워크스페이스에 직접 설치돼 있지 않다(실측: TS2307).
 *    drei 컴포넌트의 ref 타입을 그대로 뽑아 쓴다 — 그래야 `<OrbitControls ref>`
 *    에 그대로 넘길 수 있다(구조만 흉내 낸 인터페이스는 거부당한다, 실측 TS2322).
 */
export type OrbitControlsLike = NonNullable<React.ComponentRef<typeof DreiOrbitControls>>

/**
 * 물건을 열면 카메라가 그리로 날아간다 (시안 `flyTo` · `focusOn`).
 *
 * 🔴 이전 구현에는 **카메라 이동이 아예 없었다.** 마커를 눌러도 시점이 그대로라
 *    "방을 돌아다닌다" 가 성립하지 않았다 — 패널만 딱딱 바뀌었다(사용자 지적).
 *    실측으로도 확인했다: 클릭 전후 마커 화면좌표가 전부 정확히 같은 값만큼만
 *    움직였는데, 그건 카메라가 아니라 **캔버스 폭이 줄어서** 생긴 이동이었다.
 *
 * 시안이 쓴 방법 그대로다:
 *   - 대상이 화면 세로의 약 45%(`FILL`)를 차지하도록 **거리를 역산**한다
 *   - 그 사이를 `easeInOutCubic` 으로 잇는다 — 선형이면 기계처럼 보인다
 *   - **사용자가 드래그하면 비행을 포기한다.** 카메라가 고집부리면
 *     "내가 조종하는 방" 이 아니게 된다
 *
 * ⚠️ 값(FILL·DUR·거리 하한)은 시안 실측이다. 눈대중으로 바꾸지 않는다(CLAUDE.md).
 */

/**
 * 대상이 화면 세로에서 차지할 비율. 시안 실측.
 *
 * ⚠️ 이 값만으로 거리를 정하면 **너무 가까이 붙는다.** 실측 2026-09-09:
 *    현관문을 열었더니 거리 3.0 이 나와 문이 화면을 꽉 채우고 방이 안 보였다
 *    (처음 구도의 거리는 9.5 다). 아래 `CAMERA_LIMITS_FOCUS` 로 하한을 걸고,
 *    비율도 0.45 → 0.30 으로 낮췄다.
 *
 *    🔴 **방 맥락이 남아야 한다.** 대상만 화면을 채우면 "물건에 다가갔다" 가
 *       아니라 "다른 화면으로 넘어갔다" 로 읽힌다 — 그러면 패널로 안 떠나고
 *       3D 를 유지한 이유가 사라진다. 대상이 눈에 띄되 방이 보이는 선을 잡았다.
 */
const FILL = 0.2
/**
 * 연출이 도는 동안만 쓰는 "제약 없음".
 *
 * 🔴 OrbitControls 는 `update()` 마다 카메라를 제약 안으로 되돌린다. 우리가
 *    좌표를 직접 넣는 연출 구간에서는 그 보정이 **연출을 덮어쓴다.**
 */
export const FREE_LIMITS = {
  minDistance: 0.1,
  maxDistance: 1000,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI,
  minAzimuthAngle: Number.NEGATIVE_INFINITY,
  maxAzimuthAngle: Number.POSITIVE_INFINITY,
} as const

/** 물건 사이를 옮길 때의 비행 시간(ms). 시안 DUR. */
const DUR = 900

export interface FocusTarget {
  center: [number, number, number]
  radius: number
}

/**
 * 입장 연출 — 현관문 안쪽에서 방으로 걸어 들어온다 (시안 `introFly`).
 *
 * 🔴 이 연출이 **통째로 빠져 있었다.** 방이 그냥 딱 떠 있었다 —
 *    "들어와서 둘러보세요" 라고 써 놓고 정작 들어오는 순간이 없었다.
 *
 * 🔴 **문틀 바로 안쪽에서 시작한다.** 실제 값은 아래 `INTRO` 가 정본이다 —
 *    이 머리 주석에는 숫자를 적지 않는다. 한때 여기에 "문 밖 (-4.70, 1.35,
 *    -1.60) · 3.2초" 라고 적혀 있었는데 상수는 이미 문 안쪽 (-2.35, 1.35,
 *    -1.15) · 4.2초 였다. CLAUDE.md 가 "값을 바꾸기 전에 주석을 읽는다" 를
 *    규칙으로 걸어 둔 만큼, 어긋난 주석은 그 규칙을 정확히 해롭게 만든다.
 *    문 밖에서 시작하지 않는 이유는 `INTRO.from` 주석에 있다.
 *
 * ⚠️ 높이를 낮게(1.35) 잡는 것이 핵심이다. 처음에 1.55 로 뒀더니 **왼쪽 벽
 *    (높이 3.0, x=-3.1)을 넘겨다봐서** 문 밖인데도 방이 통째로 보였다 —
 *    "들어왔다" 가 안 보이고 그냥 줌아웃처럼 읽혔다(실측 스크린샷).
 *    문(높이 2.1, z=-2.12~-1.08) 중앙을 통과하는 눈높이라야 문틀이 프레임이
 *    되어 "밖에서 안을 들여다본다" 가 성립한다.
 *
 * ⚠️ 문이 **먼저** 열리고 그다음 들어간다. 닫히는 것은 다 들어온 뒤다 —
 *    닫힌 문을 통과하면 벽을 뚫는 것처럼 보인다.
 *
 * ⚠️ `prefers-reduced-motion` 이면 생략한다. 움직임을 원치 않는 사람에게
 *    3초짜리 카메라 비행은 그 자체가 장벽이다.
 */
export const INTRO = {
  /**
   * 시작 위치 — **문틀 바로 안쪽, 사람 눈높이.**
   *
   * 🔴 문 **밖**(x -4.7)에서 시작하지 않는다. 그렇게 했더니 카메라가 문에서
   *    1.88 밖에 안 떨어져 문이 잘렸고, 거리를 벌리면 벽 밖으로 나가 화면이
   *    통째로 검어졌다(실측 2026-09-16: 거리 3.6 에서 문틀조차 안 보임).
   *    화각을 58° 로 넓혀 우겨넣어 봤지만 **그 광각 자체가 어색했다**
   *    (사용자 지적: "시야각이 이상하게 나오잖음").
   *
   *    → 필요한 것은 "문 밖에서 걸어온다" 가 아니라 **"문 열고 들어선다"** 다.
   *      문틀을 막 지난 자리에서 시작하면 그 느낌이 나면서 화각도 정상이다.
   *
   * ⚠️ 너무 안쪽(시안의 x -1.30)은 안 된다 — 이미 방 한가운데라 "들어왔다" 가
   *    아니라 그냥 뒤로 줄어드는 것처럼 보인다(예전 사용자 지적).
   *    현관문이 x -2.89 이므로 그 바로 안쪽을 쓴다.
   */
  from: [-2.35, 1.35, -1.15] as [number, number, number],
  lookAt: [-0.4, 1.15, 0.1] as [number, number, number],
  /**
   * 입장에 쓰는 시간(ms).
   *
   * ⚠️ 3200 이었는데 **"확 들어온다"** 는 말을 들었다. 이동 거리가 줄어든 만큼
   *    (문 밖 → 문 안쪽) 같은 시간이면 더 느려지지만, 그것만으로는 모자랐다.
   */
  ms: 4200,
  /*
   * ⚠️ `doorOpenAt` 은 없앴다. 참조가 0 이었다 — 문은 `onIntroDoor(true)` 로
   *    **effect 에서 즉시** 연다(비행이 시작되기 전에 열려 있어야 한다).
   *    값이 0 이라 "우연히 맞는" 상태였고, 고쳐도 아무 일도 안 일어났다.
   */
  /** 문이 닫히는 시각(ms). 다 들어온 뒤다. */
  doorCloseAt: 2600,
} as const

/**
 * 이 세션에서 입장 연출을 이미 봤는가.
 *
 * ⚠️ 모듈 스코프에 둔다 — 컴포넌트가 라우트마다 다시 마운트되므로 `useRef`
 *    로는 기억하지 못한다. 새로고침하면 초기화되는 것이 맞다(그때는 방에
 *    처음 들어오는 것이다).
 */
const SEEN_KEY = 'room:intro-seen'

/**
 * 이 탭에서 입장 연출을 이미 봤는가.
 *
 * 🔴 **`sessionStorage` 에 둔다.** 모듈 스코프 `Set` 으로 뒀더니 **복귀에도
 *    3.2초짜리 연출이 그대로 재생됐다** — 실측 2026-09-09: 첫 진입 2748ms,
 *    복귀 2713ms 로 거의 같았다. 라우트를 풀 페이지로 이동하면 모듈이 새로
 *    평가되어 그 `Set` 이 비기 때문이다.
 *
 *    방을 나갔다 오는 사람에게 매번 "걸어 들어오기" 를 보이는 것은 연출이
 *    아니라 대기다. 탭을 새로 열면 초기화되는 것이 맞다(그때는 처음 오는 것이다).
 *
 * ⚠️ `sessionStorage` 는 접근 자체가 던질 수 있다(사생활 보호 모드 등).
 *    막히면 "처음 온 것" 으로 보고 연출을 보인다 — 안전한 쪽이다.
 */
function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markIntroSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // 저장이 막히면 다음에도 연출을 본다. 기능이 깨지지는 않는다.
  }
}

/** 시안 easeInOutCubic. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * 왼쪽 UI(카피·번호 목록)가 차지하는 폭. 시안 `UIW`.
 * 이 폭만큼 3D 의 실제 가용 영역이 줄어든다.
 */
const UI_WIDTH = 520
/** 열렸을 때 오른쪽 패널이 먹는 폭. `RoomPanel` 과 같아야 한다. */
const PANEL_WIDTH = 480

/**
 * 페이지에서 본문이 차지하는 폭. `PageShell` 의 본문 최대폭과 맞춘다.
 * 3D 는 그 오른쪽 여백에 선다.
 */
const PAGE_UI_WIDTH = 980

/**
 * 페이지에서 물건에 다가가는 거리의 하한.
 *
 * 🔴 홈(4.8)보다 멀다. 배경이라 물건만 크게 보이면 "작업실 안" 이 사라지고
 *    그냥 큰 3D 오브젝트가 된다 — 홈의 처음 구도가 9.5 이므로 그 사이를 쓴다.
 */
const PAGE_MIN_DISTANCE = 7.4

export function CameraRig({
  focus,
  controls,
  onIntroDoor,
  onEntered,
  onIntroStart,
  skipIntro = false,
  mode = 'room',
}: {
  /** 열린 물건의 초점. `null` 이면 처음 구도로 돌아간다. */
  focus: FocusTarget | null
  controls: React.RefObject<OrbitControlsLike | null>
  /** 입장 연출 중 문을 여닫는다. */
  onIntroDoor: (open: boolean) => void
  /** 입장이 끝났다 — 부모가 UI 를 올린다. */
  onEntered: () => void
  /**
   * 입장 비행이 **지금 시작한다** — 부모가 OrbitControls 제약을 풀어야 한다.
   *
   * 🔴 없으면 **깊은 링크로 들어온 사람에게 입장이 깨진다.** `Scene` 의
   *    `entered` 는 `useState(mode === 'page')` 라, 첫 화면이 `/work` 였다면
   *    이미 `true` 다. 그 상태로 홈에 오면 제약이 걸린 채 비행이 시작돼
   *    카메라가 끌려간다(같은 파일 `FREE_LIMITS` 주석의 그 증상).
   */
  onIntroStart: () => void
  /**
   * 입장 연출을 건너뛴다.
   *
   * 🔴 페이지에서 쓴다. 거기서는 방이 **배경**이고 이미 그 물건 앞에 와 있는
   *    상태여야 한다 — 문 밖에서 3.2초 걸어 들어오면 본문을 읽으러 온 사람을
   *    기다리게 한다.
   */
  skipIntro?: boolean
  /**
   * 이 방을 어떻게 쓰는가. 구도가 다르다.
   *
   * - `room` — 홈. 패널이 열리면 오른쪽 480px 이 가려지므로 그만큼 보정한다.
   * - `page` — 본문 배경. **패널이 없고** 왼쪽 본문이 더 넓다. 그리고 물건에
   *   바짝 붙으면 안 된다 — 배경이라 방이 보여야 "작업실 안" 이 유지된다.
   *
   * 🔴 실측 2026-09-16: 홈 값을 그대로 썼더니 물건이 화면을 꽉 채우고 방이
   *    사라졌다가, viewOffset 이 패널 폭만큼 밀려 **3D 가 오른쪽 구석으로
   *    빠져나갔다**(스크린샷으로 확인).
   */
  mode?: 'room' | 'page'
}) {
  const { camera, size } = useThree()
  const fly = useRef<{
    p0: THREE.Vector3
    t0: THREE.Vector3
    p1: THREE.Vector3
    t1: THREE.Vector3
    start: number
    ms: number
    /**
     * 입장 연출인가(문 여닫기·`onEntered` 가 달려 있다).
     * ⚠️ 이전에는 `f.ms === INTRO.ms` 로 판별했는데, 다른 비행이 우연히 같은
     *    길이가 되면 조용히 어긋난다. 종류를 값으로 들고 있는다.
     */
    intro: boolean
  } | null>(null)
  /** 입장 연출을 시작했는가. 두 번 하지 않는다. */
  const started = useRef(false)
  /**
   * 입장 비행이 **끝났는가**.
   *
   * 🔴 "시작했다" 와 "끝났다" 를 갈라야 한다. 하나로 두면 입장 도중
   *    리렌더(문이 열리며 상태가 바뀐다)가 일어날 때 초점 effect 가
   *    "이미 입장했다" 로 읽고 카메라를 홈으로 덮어써서 **연출이 통째로
   *    사라진다** — 실측 2026-09-09: 250ms 시점에 이미 최종 구도였다.
   */
  const landed = useRef(false)
  /** 입장 중 문을 이미 닫았는가. `useFrame` 이 매 프레임 돌므로 한 번만 부른다. */
  const doorClosed = useRef(false)

  // 🔴 입장 — 처음 한 번, 현관문 안쪽에서 걸어 들어온다.
  useEffect(() => {
    const ctl = controls.current
    if (!ctl || started.current) return

    // 접근성: 모션을 줄이려는 사람에게는 생략한다(시안과 같다).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      started.current = true
      landed.current = true
      onEntered()
      return
    }

    /*
     * 🔴 **페이지 배경일 때는 `started` 를 세우지 않는다.**
     *
     *    캔버스가 라우트를 넘어 살아 있으므로 이 컴포넌트는 **세션당 한 번만**
     *    마운트된다. 검색으로 `/work` 에 바로 들어온 사람은 첫 마운트가
     *    `mode='page'` 라 여기서 건너뛰는데, 예전에는 그 자리에서
     *    `started.current = true` 로 굳어 **그 뒤 홈에 와도 입장 effect 가
     *    early-return** 했다. 문이 열리고 걸어 들어오는 연출을 그 방문자는
     *    영영 못 봤고, `markIntroSeen()` 도 안 불려 나중에 홈을 새로고침하면
     *    그때 뒤늦게 풀 길이가 재생됐다("이미 본 사람은 짧게" 와 반대 방향).
     *
     *    검색 유입이 곧 수주 경로라 `/work`·`/stack` 이 첫 화면이 되기 쉽다.
     *    → 건너뛰기만 하고 **다음에 홈으로 오면 그때 입장한다.**
     */
    if (skipIntro) {
      landed.current = true
      onEntered()
      return
    }
    started.current = true

    /*
     * ⚠️ 위 경로를 지나 왔다면 `landed` 가 이미 true 다. 그대로 두면 초점
     *    effect 가 "이미 입장했다" 로 읽고 비행 중에 카메라를 덮어쓴다
     *    (`landed` 선언부 주석의 그 사고). 비행 상태를 처음부터 다시 잡는다.
     */
    landed.current = false
    doorClosed.current = false
    onIntroStart()

    /*
     * 🔴 **전체 연출은 세션당 한 번이다.**
     *
     *    캔버스가 라우트를 넘어 살아남게 되면서, 홈을 나갔다 돌아오면
     *    tunnel 의 In 이 다시 마운트되어 **입장 연출이 통째로 재생된다**
     *    (실측 2026-09-09: 복귀 후 마커가 x=81 → 949 로 2.8초 걸쳐 이동하고
     *    카피는 3.6초 뒤에야 떴다). 방을 나갔다 오는 사람에게 3.2초짜리
     *    "걸어 들어오기" 를 매번 다시 보이는 것은 연출이 아니라 대기다.
     *
     *    → 처음 한 번만 문 밖에서 걸어 들어오고, 그다음부터는 짧게 자리를
     *      잡는다. "돌아왔다" 는 보이되 기다리지는 않는다.
     */
    const first = !hasSeenIntro()
    markIntroSeen()
    const introMs = first ? INTRO.ms : INTRO.ms * 0.28

    const from = new THREE.Vector3(...INTRO.from)
    const look = new THREE.Vector3(...INTRO.lookAt)
    camera.position.copy(from)
    ctl.target.copy(look)
    ctl.update()

    /*
     * 🔴 **입장 동안 OrbitControls 제약을 푼다.**
     *
     *    `CAMERA_LIMITS` 는 `minDistance 4.6` 과 방위각 범위
     *    (`PI*0.54 ~ PI*0.98`)를 건다. 그런데 입장 시작 위치는 타깃에서
     *    **3.96** 밖에 안 떨어져 있고 방위각도 그 범위 밖이다 —
     *    `ctl.update()` 가 매 프레임 카메라를 제약 안으로 끌어당겨
     *    **문 밖에서 시작하지도 못했다.**
     *
     *    실측 2026-09-16: 시작 위치가 `[-4.7, 1.35, -1.6]` 이어야 하는데
     *    실제로는 `[3.53, 1.73, -0.77]`(이미 방 안)이었고, 비행 중간
     *    (진행 0.45)에 제약 경계를 넘으면서 **한 프레임에 좌우각이 79.3°**
     *    꺾였다. 사용자가 "갑자기 화면이 휙 돈다" 고 한 자리다.
     *
     * ⚠️ 비행이 끝나면 되돌린다 — 안 되돌리면 사용자가 방을 무한정 돌리거나
     *    벽 밖으로 나갈 수 있다.
     */
    /*
     * ⚠️ **여기서 `Object.assign(ctl, FREE_LIMITS)` 를 하면 안 된다.**
     *    `Scene` 이 `<OrbitControls {...CAMERA_LIMITS}>` 로 **prop 을 넘기므로**,
     *    리렌더될 때마다 drei 가 그 값을 다시 설정해 인스턴스 조작을 덮어쓴다.
     *    그리고 `Scene` 은 마커 실측 보고(`measured`)로 여러 번 리렌더된다 —
     *    실측 2026-09-16: 제약을 풀었는데도 600ms 시점에 이미 방 안이었다.
     *    → 제약은 **`Scene` 이 prop 으로** 바꾼다(`entered` 상태).
     */

    fly.current = {
      p0: from.clone(),
      t0: look.clone(),
      p1: new THREE.Vector3(...CAMERA_POSITION),
      t1: new THREE.Vector3(...ROOM_CENTER),
      // 0 = 아직 시작 안 함. 첫 프레임이 시계를 켠다(위 useFrame 주석 참고).
      start: 0,
      ms: introMs,
      intro: true,
    }

    /*
     * 문이 열렸다 닫힌다 — 들어온 티가 나게(시안 그대로).
     *
     * 🔴 **`setTimeout` 을 쓰지 않는다.** 벽시계로 재면 GLTF 를 파싱하는
     *    동안(프레임이 안 그려지는 동안) 타이머만 흘러, 문이 열리는 것도
     *    `onEntered` 도 **화면에 아무것도 안 나온 사이에 끝나 버린다.**
     *    비행 진행도(`useFrame`)에 맞춰 부른다 — 그래야 보이는 것과 맞는다.
     */
    onIntroDoor(true)
  }, [camera, controls, onEntered, onIntroDoor, onIntroStart, skipIntro])

  useEffect(() => {
    const ctl = controls.current
    // 🔴 **입장이 끝나기 전에는 아무것도 하지 않는다.** 입장 중 리렌더가
    //    이 effect 를 돌리는데(문이 열리며 상태가 바뀐다), 여기서 카메라를
    //    건드리면 연출이 그 자리에서 지워진다.
    if (!ctl || !landed.current) return

    const target = focus ? new THREE.Vector3(...focus.center) : new THREE.Vector3(...ROOM_CENTER)

    let position: THREE.Vector3
    if (focus) {
      /*
       * 거리 역산 — drei Bounds 와 같은 수식.
       * ⚠️ 시안 주석이 함정을 적어놨다: `max(fitH, fitW) * 3.2` 로 쓰면
       *    와이드 화면에서 fitW = fitH/aspect 라 항상 fitH 가 이겨
       *    3.2 배가 그대로 먹혀 **너무 멀어진다.**
       */
      const persp = camera as THREE.PerspectiveCamera
      const fitH = focus.radius / Math.sin((persp.fov * Math.PI) / 180 / 2)
      const fitW = fitH / (size.width / size.height)
      // 🔴 초점 상태의 거리 제약 안으로 접는다. 안 그러면 물건에 코를 박는다.
      const raw = Math.max(fitH, fitW) / FILL / 2
      // 🔴 하한을 넉넉히 잡는다. 대상만 크게 보이면 "다른 화면으로 넘어갔다" 로
      //    읽혀 3D 를 유지한 뜻이 사라진다 — 방이 보이는 선을 지킨다.
      //    처음 구도가 9.5 이므로 그 절반 언저리가 "다가갔지만 방은 보이는" 거리다.
      // 🔴 페이지는 배경이라 더 멀리 선다 — 물건이 보이되 방이 남아야 한다.
      const floor = mode === 'page' ? PAGE_MIN_DISTANCE : 4.8
      const dist = Math.min(CAMERA_LIMITS_FOCUS.maxDistance, Math.max(floor, raw))
      // 지금 보는 방향을 유지한 채 거리만 바꾼다 — 갑자기 반대편으로 돌지 않게.
      const dir = camera.position.clone().sub(ctl.target).normalize()
      position = target.clone().add(dir.multiplyScalar(dist))
    } else {
      position = new THREE.Vector3(...CAMERA_POSITION)
    }

    fly.current = {
      p0: camera.position.clone(),
      t0: ctl.target.clone(),
      p1: position,
      t1: target,
      start: performance.now(),
      ms: DUR,
      intro: false,
    }

    /*
     * 🔴 제약을 상태에 맞춰 바꾼다(시안 `applyLimits`).
     *    overview 의 `minDistance: 4.6` 을 그대로 두면 물건 앞까지 못 가고,
     *    비행이 끝나자마자 OrbitControls 가 카메라를 뒤로 밀어낸다.
     */
    const limits = focus ? CAMERA_LIMITS_FOCUS : CAMERA_LIMITS
    Object.assign(ctl, limits)

    // 🔴 사용자가 손대면 비행을 포기한다. 카메라가 고집부리지 않게(시안과 같다).
    const abort = () => {
      fly.current = null
    }
    ctl.addEventListener('start', abort)
    return () => ctl.removeEventListener('start', abort)
  }, [focus, camera, controls, size.width, size.height, mode])

  /*
   * 🔴 **투영을 민다. 카메라를 옮기지 않는다** (시안 `setFrameShift`).
   *
   *    왼쪽은 카피·번호 목록이, 오른쪽은 패널이 3D 를 덮는다. 대상을 화면
   *    한가운데 맞추면 그 가려진 영역 뒤로 들어간다 — 실측 2026-09-09:
   *    화이트보드를 열었더니 보드가 왼쪽 카피 뒤로 숨고 화면 밖으로 잘렸다.
   *
   *    카메라 위치로 보정하면 각도가 틀어져 구도가 무너진다. `setViewOffset`
   *    은 **투영만** 밀어서 각도를 유지한 채 대상을 가용 영역 중앙에 놓는다.
   *
   *    ⚠️ 홈에서도 보정한다. 시안 주석: "홈에서도 방이 왼쪽에 몰려 오른쪽이
   *       빈다" — 실제로 그랬다(스크린샷으로 확인).
   */
  /**
   * 지금 걸어야 할 투영 보정량(px). `useFrame` 도 읽는다.
   *
   * 🔴 입장 연출 동안에는 이 값을 **0 에서부터 서서히 올린다.** 문 밖에서
   *    시작할 때 카메라가 문에서 **1.88** 밖에 안 떨어져 있어 문이 화면을 크게
   *    차지하는데, 여기에 260px 보정이 그대로 걸리면 **문이 잘려 나간다**
   *    (사용자 지적: "시야가 이상하게 돼서 문이 좀 짤려서 나옴").
   *
   *    끝에서 한 번에 켜면 화면이 툭 움직이므로 비행 진행도에 맞춰 보간한다.
   */
  const shiftRef = useRef(0)
  /**
   * 지금 실제로 걸려 있는 보정량. 목표(`shiftRef`)로 **매 프레임 다가간다.**
   *
   * 🔴 패널이 열리면 목표가 `0 → 240`(PANEL_WIDTH/2)으로 바뀌는데, 그걸
   *    그대로 걸면 **화면이 한 프레임에 212px 튄다**(실측 2026-09-16:
   *    마커 클릭 직후 첫 프레임 이동 212.7px, 그 다음부터는 0.5px 씩).
   *    캔버스는 CSS 로 0.44s 걸쳐 좁아지는데 투영만 즉시 바뀌어 어긋난다.
   *    사용자가 "뚜둑뚜둑 끊긴다" 고 한 자리다.
   */
  const shiftNow = useRef(0)

  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera
    const w = size.width
    const h = size.height
    /*
     * 좁은 화면에서는 3D 를 띄우지 않으므로(폴백 3단) 가로 보정만 한다.
     *
     * 🔴 **페이지에는 패널이 없다.** 홈의 `PANEL_WIDTH` 를 그대로 빼면 3D 가
     *    오른쪽으로 그만큼 더 밀려 화면 밖으로 빠진다(실측 스크린샷).
     *    대신 왼쪽 본문이 홈의 카피보다 넓으므로 그 값을 쓴다.
     */
    const right = mode === 'page' ? 0 : focus ? PANEL_WIDTH : 0
    const left = mode === 'page' ? PAGE_UI_WIDTH : UI_WIDTH
    const shift = (left + (w - right)) / 2 - w / 2
    shiftRef.current = shift
    /*
     * 🔴 **여기서 즉시 걸지 않는다.** `useFrame` 이 매 프레임 목표로 다가간다
     *    (위 `shiftNow` 주석). 처음 마운트될 때만 맞춰 둔다 — 그때는 비교할
     *    이전 값이 없어 보간할 것도 없다.
     */
    if (shiftNow.current === 0 && !fly.current) {
      shiftNow.current = shift
      persp.setViewOffset(w, h, -shift, 0, w, h)
      persp.updateProjectionMatrix()
    }
    return () => {
      persp.clearViewOffset()
      persp.updateProjectionMatrix()
    }
  }, [camera, focus, size.width, size.height, mode])

  useFrame(() => {
    const ctl = controls.current

    /*
     * 🔴 **투영 보정을 목표로 서서히 옮긴다.** 비행 중이 아니어도 돌아야 한다 —
     *    패널을 여닫는 것만으로 목표가 바뀌기 때문이다.
     *
     * ⚠️ 0.12 는 캔버스 CSS 전환(0.44s)과 눈으로 맞춘 값이다. 크게 잡으면
     *    다시 툭 튀고, 작게 잡으면 3D 만 뒤늦게 따라온다.
     */
    if (ctl && Math.abs(shiftNow.current - shiftRef.current) > 0.3) {
      shiftNow.current += (shiftRef.current - shiftNow.current) * 0.12
      const persp = camera as THREE.PerspectiveCamera
      persp.setViewOffset(size.width, size.height, -shiftNow.current, 0, size.width, size.height)
      persp.updateProjectionMatrix()
    }

    const f = fly.current
    if (!f || !ctl) return

    /*
     * 🔴 **첫 프레임에서 시계를 시작한다.**
     *
     *    `start` 를 effect 안에서 `performance.now()` 로 잡으면, GLTF 21개를
     *    파싱하는 동안 프레임이 안 그려지는데 **시계만 흐른다.** 첫 프레임이
     *    올 때는 이미 상당 시간이 지나 연출이 중간부터 시작하거나 그냥 끝난다.
     *
     *    실측 2026-09-09 (지속 캔버스 전환): 3.2초 연출이 **1초 만에** 끝났다
     *    (200ms 에 이미 x=2.39, 1200ms 에 착지). 그래서 `onEntered` 가
     *    일찍 불려도 화면에는 연출이 안 보였다. 캔버스가 페이지 안에 있을
     *    때는 마운트와 첫 프레임이 붙어 있어 드러나지 않던 문제다.
     */
    if (f.start === 0) f.start = performance.now()

    const t = Math.min(1, (performance.now() - f.start) / f.ms)
    const e = ease(t)
    camera.position.lerpVectors(f.p0, f.p1, e)
    ctl.target.lerpVectors(f.t0, f.t1, e)
    ctl.update()

    /*
     * 🔴 입장 중에는 투영 보정을 **0 에서부터 올린다**(위 `shiftRef` 주석).
     *    문 앞에서는 보정이 없어야 문이 프레임 안에 들어온다.
     *
     * ⚠️ 뒤쪽 절반에서 올린다 — 앞에서 같이 올리면 문을 통과하는 동안 화면이
     *    옆으로 흐르는 것처럼 보인다.
     */
    if (f.intro) {
      const persp = camera as THREE.PerspectiveCamera
      const ramp = Math.max(0, (e - 0.5) * 2) // 진행 50% 부터 0→1
      shiftNow.current = shiftRef.current * ramp
      persp.setViewOffset(size.width, size.height, -shiftNow.current, 0, size.width, size.height)
      persp.updateProjectionMatrix()
    }
    // 입장 연출의 문 닫힘·완료를 **진행도**로 부른다(위 주석 참고).
    if (f.intro) {
      const closeAt = INTRO.doorCloseAt / INTRO.ms
      if (t >= closeAt && !doorClosed.current) {
        doorClosed.current = true
        onIntroDoor(false)
      }
    }

    if (t >= 1) {
      // 입장 비행이 끝나야 초점 비행이 열린다.
      if (f.intro) {
        // 보정을 최종값으로 확정한다(보간이 끝났다).
        const persp = camera as THREE.PerspectiveCamera
        shiftNow.current = shiftRef.current
        persp.setViewOffset(size.width, size.height, -shiftNow.current, 0, size.width, size.height)
        persp.updateProjectionMatrix()
        // 제약 복원은 `Scene` 이 한다 — `onEntered` 로 알린다(위 주석 참고).
        landed.current = true
        onEntered()
      }
      fly.current = null
    }
  })

  return null
}
