'use client'

import type { OrbitControls as DreiOrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  ease,
  FRAME_MS,
  frame,
  frameMotion,
  readFrame,
  targetFrame,
} from '@/features/room-3d/model/frame'
import { CAMERA_LIMITS, CAMERA_LIMITS_FOCUS, CAMERA_POSITION, ROOM_CENTER } from './layout'

// three-stdlib 는 직접 설치돼 있지 않다 — drei ref 타입을 뽑아 써야 <OrbitControls ref> 에 넘길 수 있다.
export type OrbitControlsLike = NonNullable<React.ComponentRef<typeof DreiOrbitControls>>

// 대상이 화면 세로의 FILL 만큼 차지하도록 거리를 역산하고 easeInOutCubic 으로 날아간다. 드래그하면 비행을 포기한다.
// FILL 을 키우면 대상만 화면을 채워 방 맥락이 사라진다. 값은 실측이라 눈대중으로 바꾸지 않는다.
const FILL = 0.2
/** 연출 구간 전용 "제약 없음" — update() 가 직접 넣은 좌표를 제약 안으로 되돌려 연출을 덮어쓴다. */
export const FREE_LIMITS = {
  minDistance: 0.1,
  maxDistance: 1000,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI,
  minAzimuthAngle: Number.NEGATIVE_INFINITY,
  maxAzimuthAngle: Number.POSITIVE_INFINITY,
} as const

/*
 * 초점 비행 동안 거는 제약 — CAMERA_LIMITS 와 CAMERA_LIMITS_FOCUS 의 축별 외접 상자.
 * 한쪽만 걸면 들어가는 비행은 첫 프레임에 당겨지고 나오는 비행은 6.5 에서 잘려 안 돌아온다.
 * FREE_LIMITS 와 다르다 — 그건 드래그로 방을 뚫게 한다. 외접 상자라 두 범위 밖 조합이 나올 수 있지만 벽은 안 뚫는다.
 * 입장 비행에는 걸지 않는다 — 시작 방위각이 상자 밖이라 첫 프레임에 꺾인다(입장은 Scene 이 FREE_LIMITS 를 건다).
 */
const FLIGHT_LIMITS = {
  minDistance: Math.min(CAMERA_LIMITS.minDistance, CAMERA_LIMITS_FOCUS.minDistance),
  maxDistance: Math.max(CAMERA_LIMITS.maxDistance, CAMERA_LIMITS_FOCUS.maxDistance),
  minPolarAngle: Math.min(CAMERA_LIMITS.minPolarAngle, CAMERA_LIMITS_FOCUS.minPolarAngle),
  maxPolarAngle: Math.max(CAMERA_LIMITS.maxPolarAngle, CAMERA_LIMITS_FOCUS.maxPolarAngle),
  minAzimuthAngle: Math.min(CAMERA_LIMITS.minAzimuthAngle, CAMERA_LIMITS_FOCUS.minAzimuthAngle),
  maxAzimuthAngle: Math.max(CAMERA_LIMITS.maxAzimuthAngle, CAMERA_LIMITS_FOCUS.maxAzimuthAngle),
} as const

/** 물건 사이 비행 시간(ms). */
const FOCUS_MS = 900

export interface FocusTarget {
  center: [number, number, number]
  radius: number
}

// 입장 연출 — 문틀 바로 안쪽에서 방으로 걸어 들어온다. 숫자는 INTRO 가 정본이다.
// 눈높이 1.35 가 핵심이다 — 높이면 왼쪽 벽을 넘겨다봐 "들어왔다" 가 줌아웃처럼 읽힌다.
// 문이 먼저 열리고 다 들어온 뒤 닫힌다 — 닫힌 문을 통과하면 벽을 뚫는 것처럼 보인다.
export const INTRO = {
  /** 문 밖에서 시작하면 문이 잘리거나 벽 밖이 검게 나온다. 너무 안쪽이면 뒤로 줄어드는 것처럼 보인다. */
  from: [-2.35, 1.35, -1.15] as [number, number, number],
  lookAt: [-0.4, 1.15, 0.1] as [number, number, number],
  ms: 4200,
  /** 문이 닫히는 시각(ms). 문 열기는 비행 전에 effect 에서 즉시 한다. */
  doorCloseAt: 2600,
} as const

const SEEN_KEY = 'room:intro-seen'

// sessionStorage 에 둔다 — 모듈 스코프는 풀 페이지 이동에 비어 복귀에도 연출이 재생된다. 접근이 던지면 처음 온 것으로 본다.
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
    // 저장이 막히면 다음에도 연출을 본다.
  }
}

/** 왼쪽 UI(카피·번호 목록)가 덮는 폭. */
const UI_WIDTH = 520
/** 열렸을 때 오른쪽 패널 폭. RoomPanel 과 같아야 한다. */
export const PANEL_WIDTH = 480

// 페이지에서 캔버스 왼쪽이 마스크로 지워지는 비율. tokens.css object 모드의 mask-image 42% 와 같아야 한다.
// 본문 폭을 쓰면 안 된다 — 하위 화면에서는 본문이 캔버스를 안 덮고 마스크만 덮는다.
const PAGE_MASK_LEFT = 0.42

/** 패널이 캔버스 오른쪽을 덮는 폭. 캔버스는 줄이지 않는다 — 줄이면 매 프레임 버퍼를 다시 만든다. */
function panelCover(mode: 'room' | 'page', open: boolean): number {
  return mode === 'room' && open ? PANEL_WIDTH : 0
}

/** 보이는 영역(frame)을 한 화면으로 삼은 투영을 뷰포트 크기 캔버스에 그리고 shift 만큼 오른쪽으로 민다. */
function applyView(persp: THREE.PerspectiveCamera, vw: number, vh: number, shift: number) {
  const { x, y, w, h } = frame
  if (!w || !h) return
  persp.aspect = w / h
  persp.setViewOffset(w, h, -x - shift, -y, vw, vh)
  persp.updateProjectionMatrix()
}

// 페이지는 배경이라 홈보다 멀리 선다. CAMERA_LIMITS_FOCUS.maxDistance 를 넘기면 min/max 식이 늘 상한만 뱉는다 — 더 멀리는 상한부터 올린다.
const PAGE_MIN_DISTANCE = CAMERA_LIMITS_FOCUS.maxDistance

export function CameraRig({
  focus,
  controls,
  onIntroDoor,
  onEntered,
  onIntroStart,
  skipIntro = false,
  mode = 'room',
}: {
  /** null 이면 처음 구도로 돌아간다. */
  focus: FocusTarget | null
  controls: React.RefObject<OrbitControlsLike | null>
  onIntroDoor: (open: boolean) => void
  onEntered: () => void
  /** 부모가 제약을 풀어야 한다 — 깊은 링크로 온 사람은 entered 가 이미 true 라 제약에 끌려간다. */
  onIntroStart: () => void
  /** 페이지 배경용 — 방이 이미 그 물건 앞에 와 있어야 한다. */
  skipIntro?: boolean
  /** page 는 패널이 없고 물건에 바짝 붙지 않는다. */
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
    /** 입장 연출인가. ms 로 판별하면 길이가 우연히 같을 때 어긋난다. */
    intro: boolean
  } | null>(null)
  /** 두 번 하지 않는다. */
  const started = useRef(false)
  /** started 와 갈라야 한다 — 하나로 두면 입장 중 리렌더에 초점 effect 가 카메라를 덮어써 연출이 사라진다. */
  const landed = useRef(false)
  /** useFrame 이 매 프레임 돌므로 한 번만 부른다. */
  const doorClosed = useRef(false)
  /** 비행이 끝나면 걸 제약. null 이면 걸 것이 없다(사용자가 비행을 중단). */
  const limitsAfterFly = useRef<Record<string, number> | null>(null)
  /** 비행을 시작시킨 목표를 값으로 든다 — focus 는 매 렌더 새 객체라 참조로 보면 비행이 계속 재시작된다. */
  const lastTarget = useRef<string | null>(null)
  const flightFrame = useRef<typeof frameMotion>(null)

  useEffect(() => {
    const ctl = controls.current
    if (!ctl) return

    // started 가드보다 먼저 본다 — 입장 중 다른 화면으로 나가면 입장 비행이 끝날 때까지 그 화면 구도가 안 잡힌다.
    if (skipIntro) {
      markIntroSeen()
      // 돌던 입장 비행을 접고 문도 닫는다 — 끊긴 비행은 doorCloseAt 에 영영 못 닿는다.
      if (fly.current?.intro) {
        fly.current = null
        if (!doorClosed.current) {
          doorClosed.current = true
          onIntroDoor(false)
        }
      }
      // 카메라를 처음 구도에 세운다 — 주소로 바로 들어오면 카메라가 원점 근처라 초점 비행 방향이 엉뚱해진다.
      camera.position.set(...CAMERA_POSITION)
      ctl.target.set(...ROOM_CENTER)
      ctl.update()
      landed.current = true
      onEntered()
      return
    }

    if (started.current) return

    // 사실상 도달하지 않는다(reduced-motion 이면 can-3d 가 3D 자체를 안 띄운다). 그 판정이 바뀌면 필요해지므로 둔다.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      started.current = true
      landed.current = true
      onEntered()
      return
    }

    // 페이지 모드 분기에서 started 를 세우지 않는다 — 세우면 직접 진입한 방문자가 홈에 와도 입장을 못 본다.
    started.current = true

    // 위 경로를 지났다면 landed 가 true 라 초점 effect 가 비행을 덮어쓴다 — 처음부터 다시 잡는다.
    landed.current = false
    doorClosed.current = false
    onIntroStart()

    // 전체 연출은 탭당 한 번 — 복귀 때는 짧게 자리만 잡는다.
    const first = !hasSeenIntro()
    markIntroSeen()
    const introMs = first ? INTRO.ms : INTRO.ms * 0.28

    const from = new THREE.Vector3(...INTRO.from)
    const look = new THREE.Vector3(...INTRO.lookAt)
    camera.position.copy(from)
    ctl.target.copy(look)
    ctl.update()

    // 입장 동안의 제약은 Scene 이 entered prop 으로 바꾼다. R3F 는 값이 바뀐 prop 만 다시 적용하므로 비행 중 Object.assign 은 유지된다.
    // 착지 제약을 여기서 못박는다 — 앞선 초점 비행의 FOCUS(상한 6.5)가 남으면 착지 거리에서 잘린다.
    limitsAfterFly.current = CAMERA_LIMITS

    fly.current = {
      p0: from.clone(),
      t0: look.clone(),
      p1: new THREE.Vector3(...CAMERA_POSITION),
      t1: new THREE.Vector3(...ROOM_CENTER),
      // 0 = 아직 시작 안 함. 첫 프레임이 시계를 켠다.
      start: 0,
      ms: introMs,
      intro: true,
    }

    // setTimeout 을 쓰지 않는다 — GLTF 파싱 중 벽시계만 흘러 화면에 안 보인 채 끝난다. 닫힘은 비행 진행도로 부른다.
    onIntroDoor(true)
  }, [camera, controls, onEntered, onIntroDoor, onIntroStart, skipIntro])

  // focus 는 매 렌더 새 객체라 값으로 식별한다.
  const focusKey = focus ? `${focus.center.join(',')}|${focus.radius}` : ''

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus 는 focusKey 로 식별한다
  useEffect(() => {
    const ctl = controls.current
    // 입장이 끝나기 전에는 건드리지 않는다 — 입장 중 리렌더에 연출이 지워진다.
    if (!ctl || !landed.current) return

    readFrame()
    const motion = frameMotion && frameMotion !== flightFrame.current ? frameMotion : null
    flightFrame.current = frameMotion
    const target = focus ? new THREE.Vector3(...focus.center) : new THREE.Vector3(...ROOM_CENTER)

    let position: THREE.Vector3
    if (focus) {
      // drei Bounds 와 같은 수식. max(fitH, fitW) * 3.2 로 쓰면 와이드에서 fitH 가 늘 이겨 너무 멀어진다.
      const persp = camera as THREE.PerspectiveCamera
      const fitH = focus.radius / Math.sin((persp.fov * Math.PI) / 180 / 2)
      const fw = targetFrame.w || size.width
      const fh = targetFrame.h || size.height
      const fitW = fitH / ((fw - panelCover(mode, true)) / fh)
      const raw = Math.max(fitH, fitW) / FILL / 2
      // 하한을 넉넉히 잡는다 — 대상만 크게 보이면 "다른 화면으로 넘어갔다" 로 읽힌다. 페이지는 더 멀리 선다.
      const floor = mode === 'page' ? PAGE_MIN_DISTANCE : 4.8
      const dist = Math.min(CAMERA_LIMITS_FOCUS.maxDistance, Math.max(floor, raw))
      // 보는 방향을 유지한 채 거리만 바꾼다.
      const dir = camera.position.clone().sub(ctl.target).normalize()
      position = target.clone().add(dir.multiplyScalar(dist))
    } else {
      position = new THREE.Vector3(...CAMERA_POSITION)
    }

    // 같은 목표면 비행을 재시작하지 않는다 — 전환 중 캔버스 크기가 매 프레임 바뀌어 비행이 떨린다.
    const targetKey = `${focusKey}@${mode}`
    const sameTarget = lastTarget.current === targetKey
    lastTarget.current = targetKey

    if (sameTarget) {
      if (fly.current && !fly.current.intro) {
        // 시계와 출발점은 두고 도착만 고쳐 잡는다.
        fly.current.p1 = position
        fly.current.t1 = target
        return
      }
      // 착지 후 캔버스만 바뀐 것은 연출이 아니라 적응이다 — 즉시 맞춘다.
      camera.position.copy(position)
      ctl.target.copy(target)
      ctl.update()
      return
    }

    fly.current = {
      p0: camera.position.clone(),
      t0: ctl.target.clone(),
      p1: position,
      t1: target,
      start: motion?.start ?? performance.now(),
      ms: motion?.ms ?? FOCUS_MS,
      intro: false,
    }

    // 비행 동안은 FLIGHT_LIMITS, 착지에서 정확한 제약을 건다. 시작에 FOCUS 를 걸면 첫 프레임에 당겨지고, 옛 FOCUS 를 두면 나오는 비행이 잘린다.
    // FREE_LIMITS 금지 — 전환 중 effect 가 재실행되며 FREE 를 다시 걸어, 누른 채인 사용자가 제약 밖으로 나간다.
    Object.assign(ctl, FLIGHT_LIMITS)
    limitsAfterFly.current = focus ? CAMERA_LIMITS_FOCUS : CAMERA_LIMITS

    // 사용자가 손대면 비행을 포기한다.
    const abort = () => {
      // 비행이 있을 때만 — start 는 모든 pointerdown 이라, 아니면 마커를 연 채 드래그할 때 FOCUS 제약이 바뀐다.
      if (!fly.current) return
      fly.current = null
      limitsAfterFly.current = null
      // 여기서 제약을 바꾸지 않는다 — 목적지 것도 출발 것도 중단 지점에서 카메라를 튀게 한다. FLIGHT_LIMITS 를 그대로 둔다.
      // 고치기 전에 verify-intro-state 의 비행 중 드래그 케이스를 돌린다.
    }
    ctl.addEventListener('start', abort)
    return () => ctl.removeEventListener('start', abort)
  }, [focusKey, camera, controls, size.width, size.height, mode])

  // 가려진 UI 를 피해 카메라가 아니라 투영(setViewOffset)을 민다 — 카메라를 옮기면 각도가 틀어진다.
  /** 투영 보정 목표(px). 입장 중에는 0 에서 올린다 — 문 앞에서 그대로 걸면 문이 잘린다. */
  const shiftRef = useRef(0)
  /** 실제 걸린 보정량. */
  const shiftNow = useRef(0)
  const shiftMotion = useRef<{ from: number; to: number; start: number; ms: number } | null>(null)
  const shiftFrame = useRef<typeof frameMotion>(null)
  const shiftStarted = useRef(false)

  /** 보정 목표(px, 보이는 영역 기준). 페이지는 본문이 영역 밖이라 왼쪽 마스크만 덮는다. */
  const shiftTarget = () => {
    const right = panelCover(mode, focus != null)
    const left = mode === 'page' ? targetFrame.w * PAGE_MASK_LEFT : UI_WIDTH
    return (left - right) / 2 - right / 2
  }

  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera
    return () => {
      persp.clearViewOffset()
      persp.updateProjectionMatrix()
    }
  }, [camera])

  useFrame(() => {
    const ctl = controls.current

    readFrame()
    const now = performance.now()
    shiftRef.current = shiftTarget()
    if (fly.current?.intro) {
      shiftMotion.current = null
    } else if (!shiftStarted.current) {
      shiftNow.current = shiftRef.current
      shiftStarted.current = true
    } else {
      const s = shiftMotion.current
      if (s) {
        const t = Math.min(1, (now - s.start) / s.ms)
        shiftNow.current = s.from + (s.to - s.from) * ease(t)
        if (t >= 1) shiftMotion.current = null
      }
      if (shiftRef.current !== (shiftMotion.current?.to ?? shiftNow.current)) {
        if (shiftMotion.current && shiftFrame.current === frameMotion) {
          shiftMotion.current.to = shiftRef.current
        } else {
          shiftMotion.current = {
            from: shiftNow.current,
            to: shiftRef.current,
            start: frameMotion?.start ?? now,
            ms: frameMotion?.ms ?? FRAME_MS,
          }
        }
      }
      const next = shiftMotion.current
      if (next) {
        const t = Math.min(1, (now - next.start) / next.ms)
        shiftNow.current = next.from + (next.to - next.from) * ease(t)
        if (t >= 1) shiftMotion.current = null
      }
    }
    shiftFrame.current = frameMotion
    // 영역이 전환 중에 움직이므로 매 프레임 다시 건다.
    applyView(camera as THREE.PerspectiveCamera, size.width, size.height, shiftNow.current)

    const f = fly.current
    if (!f || !ctl) return

    // 시계는 첫 프레임에 켠다 — effect 에서 켜면 GLTF 파싱 중 시계만 흘러 연출이 중간부터 시작한다.
    if (f.start === 0) f.start = now

    const t = Math.min(1, (now - f.start) / f.ms)
    const e = ease(t)
    camera.position.lerpVectors(f.p0, f.p1, e)
    ctl.target.lerpVectors(f.t0, f.t1, e)
    ctl.update()

    // 입장 중 보정은 진행 50% 부터 올린다 — 문 앞에서는 없어야 하고, 일찍 올리면 문 통과 중 화면이 옆으로 흐른다.
    if (f.intro) {
      const persp = camera as THREE.PerspectiveCamera
      const ramp = Math.max(0, (e - 0.5) * 2) // 진행 50% 부터 0→1
      shiftNow.current = shiftRef.current * ramp
      applyView(persp, size.width, size.height, shiftNow.current)
    }
    if (f.intro) {
      const closeAt = INTRO.doorCloseAt / INTRO.ms
      if (t >= closeAt && !doorClosed.current) {
        doorClosed.current = true
        onIntroDoor(false)
      }
    }

    if (t >= 1) {
      // 제약은 여기서 건다 — 시작에 걸면 한 프레임에 카메라가 당겨진다.
      if (limitsAfterFly.current) {
        Object.assign(ctl, limitsAfterFly.current)
        limitsAfterFly.current = null
      }
      if (f.intro) {
        const persp = camera as THREE.PerspectiveCamera
        shiftNow.current = shiftRef.current
        applyView(persp, size.width, size.height, shiftNow.current)
        // 제약 복원은 Scene 이 한다.
        landed.current = true
        onEntered()
      }
      fly.current = null
    }
  })

  return null
}
