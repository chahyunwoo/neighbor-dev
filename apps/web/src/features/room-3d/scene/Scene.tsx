'use client'

import { Html, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ROOM_OBJECTS } from '@/entities/room'
import { readFrame } from '@/features/room-3d/model/frame'
import { anchorFromBox } from './anchors'
import {
  CameraRig,
  type FocusTarget,
  FREE_LIMITS,
  type OrbitControlsLike,
  PANEL_WIDTH,
} from './CameraRig'
import { BLOOM_NIGHT, DaylightSync } from './DaylightSync'
import { setDaylightTarget } from './daylight'
import {
  MONITOR_POSITION,
  Monitor,
  Pendant,
  WHITEBOARD_POSITION,
  WHITEBOARD_ROTATION_Y,
  Whiteboard,
} from './Fixtures'
import { Furniture } from './Furniture'
import { Lights } from './Lights'
import { CAMERA_FOV, CAMERA_LIMITS, FOCUS_PULL, LAYOUT, ROOM_CENTER } from './layout'
import styles from './Scene.module.css'
import { ROOM_BG, Shell } from './Shell'

/** CSS Module 해시가 아닌 고정 문자열 — useEdgeClamp 가 querySelectorAll 로 찾는다. */
const MARKER_WRAP = 'room-marker-wrap'
/** 마커 반지름(15)보다 커야 잘리지 않는다. */
const EDGE_PAD = 26
/** 가장자리에 붙은 것끼리 최소 간격(px). 이보다 가까우면 아래로 민다. */
const EDGE_GAP = 34
/** 왼쪽 UI 가 덮는 폭. CameraRig 의 UI_WIDTH 와 같아야 한다. 좁은 화면에서는 w*0.5 로 접는다. */
const UI_LEFT = 520

// 하나씩 늦게 뜨면 방이 조립되는 것이 보인다.
for (const p of LAYOUT) useGLTF.preload(`/models/${p.model}.glb`)

// 표현 계층이다. 클릭 지점과 링크는 entities/room 이 쥔다 — 여기서 새로 만들면 목록 폴백·서버 HTML 과 어긋난다.
// 펜던트는 상판 위 0.85m — 천장에 붙이면 천장 없는 구도에서 책상 위에 뜬 것처럼 보인다.
const PENDANT_Y = 1.55
const PENDANT_POSITION: [number, number, number] = [1.19, PENDANT_Y, -0.25]
const PENDANT_SWITCH: [number, number, number] = [1.19, PENDANT_Y - 0.06, -0.25]

export function Scene({
  openId,
  seen,
  onOpen,
  onEntered,
  onIntroStart,
  mode = 'room',
  night = true,
  onToggleLight,
}: {
  /** 바뀌면 1.1초에 걸쳐 조명이 넘어간다. */
  night?: boolean
  /** 홈 전용. */
  onToggleLight?: () => void
  openId: string | null
  seen: ReadonlySet<string>
  onOpen: (id: string) => void
  onEntered: () => void
  /** 부모가 entered 를 되돌린다 — 안 하면 재입장 비행 중에도 data-room-entered 가 true 라 프로브가 비행 중에 클릭한다. */
  onIntroStart: () => void
  /** page 는 같은 방에서 카메라만 물건 앞에 둔다 — 물건만 따로 띄우면 전환 때 장면이 한 프레임에 통째로 갈린다. */
  mode?: 'room' | 'page'
}) {
  const controls = useRef<OrbitControlsLike>(null)
  /** 입장 연출이 문을 여는 동안만 true. 열린 물건과는 별개다. */
  const [introDoor, setIntroDoor] = useState(false)

  /*
   * 입장 비행이 끝나야 CAMERA_LIMITS 를 건다 — 시작 위치가 제약 밖이라 update() 가 카메라를 끌어당긴다.
   */
  const [entered, setEntered] = useState(mode === 'page')

  const bloomRef = useRef<React.ComponentRef<typeof Bloom>>(null)
  useEffect(() => {
    setDaylightTarget(night)
  }, [night])
  const handleEntered = useCallback(() => {
    setEntered(true)
    onEntered()
  }, [onEntered])
  // 입장 시작 시 제약을 다시 푼다 — 본문 화면에서 먼저 들어오면 entered 가 이미 true 다.
  const handleIntroStart = useCallback(() => {
    setEntered(false)
    // provider 쪽도 되돌려야 data-room-entered 가 꺼진다.
    onIntroStart()
  }, [onIntroStart])

  useEdgeClamp()

  // 이미 모델을 연 Furniture 가 앵커를 보고한다 — 여기서 다시 열면 반복문 안 훅 호출이 된다.
  const [measured, setMeasured] = useState<Record<string, [number, number, number]>>({})
  const report = useCallback((id: string, at: [number, number, number]) => {
    setMeasured((prev) => {
      const old = prev[id]
      if (old && old[0] === at[0] && old[1] === at[1] && old[2] === at[2]) return prev
      return { ...prev, [id]: at }
    })
  }, [])

  const anchors: { id: string; at: [number, number, number]; radius: number }[] = [
    ...LAYOUT.flatMap((p) => {
      if (!p.hotspot) return []
      // 아직 안 재였으면 배치 좌표로 버틴다.
      const at = measured[p.hotspot] ?? (p.position as [number, number, number])
      const sc = Array.isArray(p.scale) ? Math.max(...p.scale) : p.scale
      return [{ id: p.hotspot, at, radius: Math.max(0.45, sc * 0.42) }]
    }),
    { id: 'monitor', at: anchorFromBox(MONITOR_POSITION, 0.28), radius: 0.6 },
    { id: 'whiteboard', at: anchorFromBox(WHITEBOARD_POSITION, 0.64), radius: 1.1 },
  ]

  const hotspots = anchors.flatMap((a) => {
    const meta = ROOM_OBJECTS.find((o) => o.id === a.id)
    // 짝이 없으면 그리지 않는다 — verify-room.mjs 가 짝을 전수 확인한다.
    return meta ? [{ at: a.at, radius: a.radius, meta }] : []
  })

  const focus: FocusTarget | null = (() => {
    const h = hotspots.find((x) => x.meta.id === openId)
    if (!h) return null
    // 마커는 물건 위에 있으니 초점을 내려 몸통을 본다.
    const y = h.at[1] - h.radius * 0.6

    // 벽에 붙은 물건은 초점을 방 안쪽으로 당긴다(layout.ts FOCUS_PULL).
    const pull = FOCUS_PULL[h.meta.id] ?? 0
    if (pull === 0) return { center: [h.at[0], y, h.at[2]], radius: h.radius }

    const dx = ROOM_CENTER[0] - h.at[0]
    const dz = ROOM_CENTER[2] - h.at[2]
    const len = Math.hypot(dx, dz) || 1
    return {
      center: [h.at[0] + (dx / len) * pull, y, h.at[2] + (dz / len) * pull],
      radius: h.radius,
    }
  })()

  return (
    <>
      {/* position 을 여기서 주지 않는다 — 리렌더마다 다시 적용돼 입장 연출을 되감는다. 카메라 위치는 CameraRig 가 쥔다. */}
      {/* 비율은 CameraRig 가 매 프레임 정한다 — drei 는 렌더마다 캔버스 비율로 덮어쓴다. */}
      <PerspectiveCamera makeDefault manual fov={CAMERA_FOV} />
      <color attach="background" args={[ROOM_BG]} />
      <DaylightSync bloom={bloomRef} />
      <Lights />

      {/* key 는 좌표로 — 같은 모델이 여러 번 오고, index 는 재정렬 시 어긋난다. */}
      {LAYOUT.map((p) => (
        <Furniture
          key={`${p.model}@${p.position.join(',')}`}
          placement={p}
          openId={introDoor && p.hotspot === 'door' ? 'door' : openId}
          onAnchor={report}
        />
      ))}

      <Monitor position={MONITOR_POSITION} />
      <Whiteboard position={WHITEBOARD_POSITION} rotationY={WHITEBOARD_ROTATION_Y} />

      <Shell />

      <Pendant position={PENDANT_POSITION} onPick={mode === 'room' ? onToggleLight : undefined} />

      {/* 펜던트 모델을 눌러도 같다. */}
      {mode === 'room' && entered && openId === null && onToggleLight ? (
        <Html position={PENDANT_SWITCH} center zIndexRange={[10, 0]}>
          <button type="button" className={styles.lampSwitch} onClick={onToggleLight}>
            <span className={styles.lampRing} aria-hidden="true" />
            <b className={styles.lampLabel}>{night ? '불을 켜보세요' : '불을 꺼보세요'}</b>
          </button>
        </Html>
      ) : null}

      {(mode === 'room' ? hotspots : []).map(({ at, meta }) => (
        <Html
          key={meta.id}
          position={at}
          center
          // useEdgeClamp 가 이 표식으로 찾는다.
          wrapperClass={MARKER_WRAP}
          /* distanceFactor 는 값이 클수록 마커가 커진다. */
          distanceFactor={5}
          zIndexRange={[10, 0]}
        >
          <button
            type="button"
            className={styles.marker}
            data-accent={meta.accent}
            data-open={meta.id === openId}
            data-seen={seen.has(meta.id) && meta.id !== openId}
            onClick={() => onOpen(meta.id)}
            aria-label={`${meta.name} — ${meta.opens}`}
            aria-expanded={meta.id === openId}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.markerName}>
              <b>{meta.no}</b>
              {meta.name}
            </span>
          </button>
        </Html>
      ))}

      <CameraRig
        focus={focus}
        controls={controls}
        onIntroDoor={setIntroDoor}
        onEntered={handleEntered}
        onIntroStart={handleIntroStart}
        skipIntro={mode === 'page'}
        mode={mode}
      />

      <OrbitControls
        ref={controls}
        target={ROOM_CENTER}
        /* 페이지 배경에서 드래그를 받으면 스크롤을 뺏는다. */
        enabled={mode === 'room'}
        enablePan={false}
        // 아이소메트릭 구도 유지.
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        {...(entered ? CAMERA_LIMITS : FREE_LIMITS)}
      />

      <EffectComposer>
        <Bloom
          ref={bloomRef}
          intensity={BLOOM_NIGHT}
          luminanceThreshold={0.55}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
      </EffectComposer>
    </>
  )
}

// 캔버스 밖으로 밀려난 마커를 가장자리에 붙인다. drei 가 transform 을 인라인으로 매 프레임 덮어써 CSS 로는 못 한다.
// 안쪽 마커는 건드리지 않는다 — 3D 앵커를 둬야 물건 위에 떠 있다.
function useEdgeClamp() {
  useEffect(() => {
    // 마커 래퍼는 canvas.parentElement 바로 밑이 아니다(drei 가 한 겹 끼운다) — 문서 전체에서 찾는다.
    const root = document

    let raf = 0
    /** 패널이 덮는 폭. CameraRig 투영 보정과 같은 비율로 따라간다 — 한 번에 바꾸면 한 프레임에 튄다. */
    let cover = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const coverTo = document.documentElement.dataset.panelOpen === 'true' ? PANEL_WIDTH : 0
      cover = Math.abs(coverTo - cover) < 0.5 ? coverTo : cover + (coverTo - cover) * 0.12
      // 캔버스는 뷰포트 전체이고 접는 경계는 보이는 영역이다.
      const { x: fx, y: fy, w, h } = readFrame()
      if (!w || !h) return

      const wraps = [...root.querySelectorAll<HTMLElement>(`.${MARKER_WRAP}`)]
      /** 최종 화면 위치는 계산이 아니라 측정한다 — drei 변환 위에 --edge-dx 보정이 버튼에 걸려 있다. */
      const onScreen = (el: HTMLElement) => {
        const btn = el.querySelector('button')
        if (!btn) return null
        const r = btn.getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }

      for (const el of wraps) {
        const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(el.style.transform)
        if (!m) continue
        const x = Number(m[1])
        const y = Number(m[2])
        // 보정은 래퍼(drei 가 scale 을 건다) 안쪽에서 적용되므로 px 가 그 배로 늘어난다.
        // 나눠서 넣지 않으면 가장자리 마커가 반대쪽으로 수백 px 미끄러진다(#88).
        const sm = /scale\(([-\d.]+)/.exec(el.style.transform)
        const scale = sm && Number(sm[1]) > 0 ? Number(sm[1]) : 1

        // 캔버스가 아니라 왼쪽 UI 를 뺀 가용 영역으로 접는다 — UI 뒤로 들어가면 안 눌린다.
        const left = fx + Math.min(UI_LEFT, w * 0.5) + EDGE_PAD
        // 패널은 캔버스를 덮으므로 그 밑으로 접으면 마커가 패널 뒤에 숨는다.
        const right = fx + w - cover - EDGE_PAD
        const cx = Math.min(right, Math.max(left, x))
        const cy = Math.min(fy + h - EDGE_PAD, Math.max(fy + EDGE_PAD, y))
        const clamped = cx !== x || cy !== y

        // 접은 값을 transform 에 쓰지 않는다 — 다음 프레임에 원본으로 읽혀 판정이 꺼지고, 덧대면 누적된다.
        // 보정량만 변수로 넘기고 적용은 자식 요소가 한다.
        el.style.setProperty('--edge-dx', `${(cx - x) / scale}px`)
        el.style.setProperty('--edge-dy', `${(cy - y) / scale}px`)
        if ((el.dataset.edge === 'true') !== clamped) {
          el.dataset.edge = clamped ? 'true' : 'false'
        }
      }

      /*
       * 접힌 마커가 제자리 마커를 덮으면 접힌 쪽이 비킨다 — 제자리 것을 옮기면 물건을 못 가리킨다.
       * 판정은 측정으로 한다(drei 의 scale 때문에 좌표 거리와 화면 거리가 다르다). DOM 순서로 아래로만 민다 — 순서가 바뀌면 떨린다.
       */
      const taken: { x: number; y: number }[] = []
      for (const el of wraps) {
        if (el.dataset.edge !== 'true') {
          const at = onScreen(el)
          if (at) taken.push(at)
        }
      }
      for (const el of wraps) {
        if (el.dataset.edge !== 'true') continue
        const at = onScreen(el)
        if (!at) continue

        let shift = 0
        const dy = Number.parseFloat(el.style.getPropertyValue('--edge-dy')) || 0
        while (
          taken.some(
            (q) => Math.abs(q.x - at.x) < EDGE_GAP && Math.abs(q.y - (at.y + shift)) < EDGE_GAP,
          )
        ) {
          shift += EDGE_GAP
          // 화면 밖으로 내보내느니 포기한다.
          if (at.y + shift > fy + h - EDGE_PAD) {
            shift = 0
            break
          }
        }
        if (shift) el.style.setProperty('--edge-dy', `${dy + shift}px`)
        taken.push({ x: at.x, y: at.y + shift })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
}
