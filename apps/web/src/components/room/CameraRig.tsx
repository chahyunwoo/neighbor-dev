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
 * 시안 실측값 그대로다:
 *   시작 위치 (-1.30, 1.60, -1.55) — 현관문(x≈-2.9) 안쪽
 *   시작 시선 ( 0.40, 1.10,  1.30) — 방 안쪽을 본다
 *   3초에 걸쳐 처음 구도로 물러난다
 *
 * ⚠️ `prefers-reduced-motion` 이면 생략한다(시안도 같다). 움직임을 원치
 *    않는 사람에게 3초짜리 카메라 비행은 그 자체가 장벽이다.
 */
export const INTRO = {
  from: [-1.3, 1.6, -1.55] as [number, number, number],
  lookAt: [0.4, 1.1, 1.3] as [number, number, number],
  ms: 3000,
  /** 문이 열리고 닫히는 시각(ms). 들어온 티가 나게. */
  doorOpenAt: 50,
  doorCloseAt: 1900,
} as const

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

export function CameraRig({
  focus,
  controls,
  onIntroDoor,
  onEntered,
}: {
  /** 열린 물건의 초점. `null` 이면 처음 구도로 돌아간다. */
  focus: FocusTarget | null
  controls: React.RefObject<OrbitControlsLike | null>
  /** 입장 연출 중 문을 여닫는다. */
  onIntroDoor: (open: boolean) => void
  /** 입장이 끝났다 — 부모가 UI 를 올린다. */
  onEntered: () => void
}) {
  const { camera, size } = useThree()
  const fly = useRef<{
    p0: THREE.Vector3
    t0: THREE.Vector3
    p1: THREE.Vector3
    t1: THREE.Vector3
    start: number
    ms: number
  } | null>(null)
  /** 입장 연출을 이미 했는가. 두 번 하지 않는다. */
  const entered = useRef(false)

  // 🔴 입장 — 처음 한 번, 현관문 안쪽에서 걸어 들어온다.
  useEffect(() => {
    const ctl = controls.current
    if (!ctl || entered.current) return
    entered.current = true

    // 접근성: 모션을 줄이려는 사람에게는 생략한다(시안과 같다).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onEntered()
      return
    }

    const from = new THREE.Vector3(...INTRO.from)
    const look = new THREE.Vector3(...INTRO.lookAt)
    camera.position.copy(from)
    ctl.target.copy(look)
    ctl.update()

    fly.current = {
      p0: from.clone(),
      t0: look.clone(),
      p1: new THREE.Vector3(...CAMERA_POSITION),
      t1: new THREE.Vector3(...ROOM_CENTER),
      start: performance.now(),
      ms: INTRO.ms,
    }

    // 문이 열렸다 닫힌다 — 들어온 티가 나게(시안 그대로).
    const t1 = setTimeout(() => onIntroDoor(true), INTRO.doorOpenAt)
    const t2 = setTimeout(() => onIntroDoor(false), INTRO.doorCloseAt)
    const t3 = setTimeout(() => onEntered(), INTRO.doorCloseAt + 100)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [camera, controls, onEntered, onIntroDoor])

  useEffect(() => {
    const ctl = controls.current
    // 입장 중에는 초점 비행을 걸지 않는다 — 두 비행이 겹치면 튄다.
    if (!ctl || !entered.current) return
    // 입장 비행이 아직 도는 중이면 그대로 둔다(focus 는 처음엔 null 이다).
    if (fly.current && fly.current.ms === INTRO.ms && focus === null) return

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
      const dist = Math.min(CAMERA_LIMITS_FOCUS.maxDistance, Math.max(4.8, raw))
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
  }, [focus, camera, controls, size.width, size.height])

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
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera
    const w = size.width
    const h = size.height
    // 좁은 화면에서는 3D 를 띄우지 않으므로(폴백 3단) 가로 보정만 한다.
    const right = focus ? PANEL_WIDTH : 0
    const shift = (UI_WIDTH + (w - right)) / 2 - w / 2
    persp.setViewOffset(w, h, -shift, 0, w, h)
    persp.updateProjectionMatrix()
    return () => {
      persp.clearViewOffset()
      persp.updateProjectionMatrix()
    }
  }, [camera, focus, size.width, size.height])

  useFrame(() => {
    const f = fly.current
    const ctl = controls.current
    if (!f || !ctl) return

    const t = Math.min(1, (performance.now() - f.start) / f.ms)
    const e = ease(t)
    camera.position.lerpVectors(f.p0, f.p1, e)
    ctl.target.lerpVectors(f.t0, f.t1, e)
    ctl.update()
    if (t >= 1) fly.current = null
  })

  return null
}
