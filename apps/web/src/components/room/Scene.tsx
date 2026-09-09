'use client'

import { Html, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useCallback, useRef, useState } from 'react'
import { ROOM_OBJECTS } from '../../lib/room'
import { anchorFromBox } from './anchors'
import { CameraRig, type FocusTarget, type OrbitControlsLike } from './CameraRig'
import {
  MONITOR_POSITION,
  Monitor,
  WHITEBOARD_POSITION,
  WHITEBOARD_ROTATION_Y,
  Whiteboard,
} from './Fixtures'
import { Furniture } from './Furniture'
import { Lights } from './Lights'
import { CAMERA_FOV, CAMERA_LIMITS, LAYOUT, ROOM_CENTER } from './layout'
import styles from './Scene.module.css'
import { ROOM_BG, Shell } from './Shell'

// 배치에 쓰는 모델을 미리 받아 둔다 — 하나씩 늦게 뜨면 방이 조립되는 것이 보인다.
for (const p of LAYOUT) useGLTF.preload(`/models/${p.model}.glb`)

/**
 * 작업실 3D.
 *
 * 🔴 이 컴포넌트는 **표현 계층일 뿐이다.** 클릭 지점과 그 뜻은 `lib/room.ts` 가
 *    쥐고 있고, 목록 폴백·서버 렌더 HTML 이 같은 데이터를 쓴다(기획서 4절).
 *    여기서 링크를 새로 만들지 않는다 — 만들면 세 경로가 어긋난다.
 */
export function Scene({
  openId,
  seen,
  onOpen,
  onEntered,
}: {
  /** 지금 열려 있는 물건. 마커가 그 상태를 보여준다. */
  openId: string | null
  /** 이미 열어본 것 — 흐려져서 "남은 것" 이 눈에 띈다(시안 .mk.seen). */
  seen: ReadonlySet<string>
  onOpen: (id: string) => void
  /** 입장 연출이 끝났다 — 부모가 UI 를 올린다. */
  onEntered: () => void
}) {
  const controls = useRef<OrbitControlsLike>(null)
  /** 입장 연출이 문을 여는 동안만 true. 열린 물건과는 별개다. */
  const [introDoor, setIntroDoor] = useState(false)

  /*
   * 마커 위치 — 물건의 **실제 꼭대기**에서 낸다(`anchors.ts` 참고).
   *
   * 🔴 이전에는 배치 원점 + 고정값 0.85 였다. 배치 원점은 대개 바닥이고
   *    물건 높이가 제각각이라 마커가 엉뚱한 데 떴다 — 실측 2026-09-09:
   *    화이트보드 마커가 허공에, 모니터 마커가 화이트보드 위에 있었다.
   */
  /**
   * 마커 위치 — 물건의 **실제 꼭대기**에서 낸다(`anchors.ts`).
   *
   * 🔴 이전에는 배치 원점 + 고정값 0.85 였다. 배치 원점은 대개 바닥이고
   *    물건 높이가 제각각이라 마커가 엉뚱한 데 떴다 — 실측 2026-09-09:
   *    화이트보드 마커가 허공에, 모니터 마커가 화이트보드 위에 있었다.
   *
   * ⚠️ 계산에는 로드된 모델이 필요하다. 여기서 모델을 다시 열면 반복문 안에서
   *    훅을 부르게 되므로, **이미 열어 둔 `Furniture` 가 보고**하게 한다.
   */
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
      // 아직 안 재였으면 배치 좌표로 버틴다 — 한 프레임 뒤 제자리를 찾는다.
      const at = measured[p.hotspot] ?? (p.position as [number, number, number])
      const sc = Array.isArray(p.scale) ? Math.max(...p.scale) : p.scale
      return [{ id: p.hotspot, at, radius: Math.max(0.45, sc * 0.42) }]
    }),
    // 직접 만든 고정물 — 크기를 알고 있으니 그 값으로 낸다(Fixtures 실측값).
    { id: 'monitor', at: anchorFromBox(MONITOR_POSITION, 0.28), radius: 0.6 },
    { id: 'whiteboard', at: anchorFromBox(WHITEBOARD_POSITION, 0.64), radius: 1.1 },
  ]

  const hotspots = anchors.flatMap((a) => {
    const meta = ROOM_OBJECTS.find((o) => o.id === a.id)
    // 🔴 짝이 없으면 그리지 않는다. 조용히 어긋나느니 안 보이는 편이 낫다 —
    //    verify-room.mjs 가 이 짝을 전수로 확인한다.
    return meta ? [{ at: a.at, radius: a.radius, meta }] : []
  })

  // 열린 물건의 초점 — 카메라가 여기로 날아간다.
  const focus: FocusTarget | null = (() => {
    const h = hotspots.find((x) => x.meta.id === openId)
    if (!h) return null
    // 마커는 물건 **위**에 있으므로, 초점은 그만큼 내려 물건 몸통을 본다.
    return { center: [h.at[0], h.at[1] - h.radius * 0.6, h.at[2]], radius: h.radius }
  })()

  return (
    <>
      {/*
       * 🔴 카메라를 **씬이 낸다.** 캔버스는 앱 전체에 하나뿐이고
       *    (`components/canvas/CanvasShell.tsx`) 홈과 페이지의 카메라가
       *    다르다(여기 fov 37 · [7.2,5,-3.6] / 페이지 fov 34 · [3.4,2.2,4.2]).
       *    `<Canvas camera={...}>` 는 **마운트 시 1회만** 반영되어 라우트마다
       *    바꿀 수 없다 — `makeDefault` 는 drei 가 교체하고 언마운트 때 되돌린다.
       *
       * ⚠️ 값은 프로토타입 실측이다(`layout.ts` 주석 참고). 자리만 옮겼다.
       *
       * 🔴 **`position` 을 여기서 주지 않는다.** 이 컴포넌트는 마커 실측
       *    보고(`report`)와 문 여닫힘 때문에 여러 번 리렌더되는데, 그때마다
       *    React 가 `position` 을 다시 적용해 **입장 연출을 매 프레임
       *    되감는다** — 실측 2026-09-09: 마커 좌표가 800ms 부터 최종
       *    위치에 고정됐고 `onEntered` 가 영영 안 불려 **카피·목록·어둠막이
       *    통째로 안 보였다.** 카메라 위치는 `CameraRig` 가 쥔다.
       */}
      <PerspectiveCamera makeDefault fov={CAMERA_FOV} />
      <color attach="background" args={[ROOM_BG]} />
      <Lights />

      {/*
       * key 는 좌표로 만든다 — 같은 모델(chairRounded 4개)이 여러 번 오므로
       * 모델명만으로는 겹치고, 배열 index 는 배치를 재정렬하면 어긋난다.
       * 좌표는 이 방에서 유일하다(한 자리에 두 개를 놓지 않는다).
       */}
      {LAYOUT.map((p) => (
        <Furniture
          key={`${p.model}@${p.position.join(',')}`}
          placement={p}
          openId={introDoor && p.hotspot === 'door' ? 'door' : openId}
          onAnchor={report}
        />
      ))}

      {/* 팩에 없거나 못 쓰는 것 — 배지 1·2 라 빠지면 안 된다. */}
      <Monitor position={MONITOR_POSITION} />
      <Whiteboard position={WHITEBOARD_POSITION} rotationY={WHITEBOARD_ROTATION_Y} />

      {/* 방 껍데기 — 벽이 빛을 되돌려 방을 밝힌다. 장식이 아니다. */}
      <Shell />

      {hotspots.map(({ at, meta }) => (
        <Html
          key={meta.id}
          position={at}
          center
          /*
           * 🔴 **값이 클수록 마커가 커진다** — 방향을 반대로 알고 8 → 14 로
           *    올렸다가 더 커졌다(실측 스크린샷으로 확인). drei 의
           *    `distanceFactor` 는 "이 거리에서 1배" 라는 기준 거리이므로,
           *    값을 키우면 같은 거리에서 더 크게 그려진다.
           *    마커는 안내지 주인공이 아니다 — 낮춘다.
           */
          distanceFactor={5}
          zIndexRange={[10, 0]}
        >
          {/*
           * 시안의 마커: **점 + 퍼지는 링**, 라벨은 hover·열림에만.
           * 이전 구현은 라벨을 항상 띄워 6개가 방을 덮었다(실측 스크린샷).
           * 시안 주석도 같은 실패를 적어놨다 — "상시 문구·큰 링은 시끄러웠다".
           */}
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
        onEntered={onEntered}
      />

      <OrbitControls
        ref={controls}
        target={ROOM_CENTER}
        enablePan={false}
        // 줌은 막는다 — 아이소메트릭 구도를 유지한다(기획서 4절).
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        {...CAMERA_LIMITS}
      />

      {/* 포스트프로세싱은 데스크톱에서만 켠다 — 부모가 그 판단을 한다. */}
      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>
    </>
  )
}
