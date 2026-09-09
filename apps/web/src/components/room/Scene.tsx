'use client'

import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useRouter } from 'next/navigation'
import { ROOM_OBJECTS } from '../../lib/room'
import {
  MONITOR_POSITION,
  Monitor,
  WHITEBOARD_POSITION,
  WHITEBOARD_ROTATION_Y,
  Whiteboard,
} from './Fixtures'
import { Furniture } from './Furniture'
import { Lights } from './Lights'
import { CAMERA_LIMITS, LAYOUT, ROOM_CENTER } from './layout'
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
export function Scene() {
  const router = useRouter()

  // 배치 중 클릭 지점이 있는 것만 골라, lib/room.ts 의 정의와 맞춘다.
  // 배치에서 오는 것 + 직접 만든 고정물. 좌표만 다르고 뜻은 같다.
  const anchors: { id: string; at: [number, number, number] }[] = [
    ...LAYOUT.flatMap((p) =>
      p.hotspot ? [{ id: p.hotspot, at: p.position as [number, number, number] }] : [],
    ),
    { id: 'monitor', at: MONITOR_POSITION },
    { id: 'whiteboard', at: WHITEBOARD_POSITION },
  ]

  const hotspots = anchors.flatMap((a) => {
    const meta = ROOM_OBJECTS.find((o) => o.id === a.id)
    // 🔴 짝이 없으면 그리지 않는다. 조용히 어긋나느니 안 보이는 편이 낫다 —
    //    verify-room.mjs 가 이 짝을 전수로 확인한다.
    return meta ? [{ at: a.at, meta }] : []
  })

  return (
    <>
      <color attach="background" args={[ROOM_BG]} />
      <Lights />

      {/*
       * key 는 좌표로 만든다 — 같은 모델(chairRounded 4개)이 여러 번 오므로
       * 모델명만으로는 겹치고, 배열 index 는 배치를 재정렬하면 어긋난다.
       * 좌표는 이 방에서 유일하다(한 자리에 두 개를 놓지 않는다).
       */}
      {LAYOUT.map((p) => (
        <Furniture key={`${p.model}@${p.position.join(',')}`} placement={p} />
      ))}

      {/* 팩에 없거나 못 쓰는 것 — 배지 1·2 라 빠지면 안 된다. */}
      <Monitor position={MONITOR_POSITION} />
      <Whiteboard position={WHITEBOARD_POSITION} rotationY={WHITEBOARD_ROTATION_Y} />

      {/* 방 껍데기 — 벽이 빛을 되돌려 방을 밝힌다. 장식이 아니다. */}
      <Shell />

      {hotspots.map(({ at, meta }) => (
        <Html
          key={meta.id}
          position={[at[0], at[1] + 1.0, at[2]]}
          center
          distanceFactor={8}
          zIndexRange={[10, 0]}
        >
          <button
            type="button"
            className={styles.marker}
            data-accent={meta.accent}
            onClick={() => router.push(meta.href)}
            aria-label={`${meta.name} — ${meta.opens}`}
          >
            <span className={styles.markerNo}>{meta.no}</span>
            <span className={styles.markerName}>{meta.name}</span>
          </button>
        </Html>
      ))}

      <OrbitControls
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
