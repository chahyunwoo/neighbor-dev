'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { DAY_MUL, daylight, mixDay } from './daylight'
import { DESK_TOP } from './layout'

/**
 * 방의 조명 — 프로토타입(.wip/room2.html)의 11개 등을 그대로 옮겼다.
 *
 * ⚠️ **눈대중으로 줄이지 않는다.** 처음에 5개로 대충 넣었더니 가구가 전부
 *    갈색으로 뭉개지고 회의 구역이 통째로 안 보였다(실측 2026-09-09,
 *    스크린샷 대조로 확인). 프로토타입 주석에도 같은 기록이 있다 —
 *    *"회의 코너는 조명이 없어 어두웠다(실측). 천장등을 하나 단다."*
 *
 * 🔴 톤매핑이 절반이다. `ACESFilmic` + exposure 0.88 이 없으면 같은 조명값이
 *    전혀 다르게 나온다 — Canvas 쪽에서 설정한다(Room.tsx).
 *
 * 기획서 4-A 의 대비를 조명이 진다: 램프·회의등만 따뜻하고 나머지는 차갑다.
 */

/** 뒷벽 z. 프로토타입의 FZ + RD/2 와 같다(0.55 + 5.6/2). */
const BACK_WALL_Z = 3.35

/** 밤(기본) 세기. 낮에는 `DAY_MUL` 을 곱한다. */
const NIGHT = {
  ambient: 0.14,
  hemi: 0.18,
  key: 22,
  sun: 0.36,
  fill: 0.17,
  win: 4.5,
  mon: 3.2,
  lamp: 2.2,
  door: 2.4,
  floor: 2.8,
  board: 12,
  meet: 16,
} as const

type LightKey = keyof typeof NIGHT

export function Lights() {
  const refs = useRef<Partial<Record<LightKey, THREE.Light | null>>>({})
  const at = (k: LightKey) => (l: THREE.Light | null) => {
    refs.current[k] = l
  }
  const applied = useRef(daylight.t)

  useFrame(() => {
    if (applied.current === daylight.t) return
    applied.current = daylight.t
    for (const k of Object.keys(NIGHT) as LightKey[]) {
      const l = refs.current[k]
      if (l) l.intensity = mixDay(NIGHT[k], DAY_MUL[k])
    }
  })

  return (
    <>
      {/* 바탕 — 아주 약하게. 이것만으로는 아무것도 안 보인다. */}
      <ambientLight ref={at('ambient')} color={0x39415a} intensity={NIGHT.ambient} />
      <hemisphereLight
        ref={at('hemi')}
        color={0x6e82a8}
        groundColor={0x1a140e}
        intensity={NIGHT.hemi}
      />

      {/* 키 라이트 — 책상을 비추는 따뜻한 등. 그림자를 만든다. */}
      <Spot
        lightRef={at('key')}
        color={0xffb067}
        intensity={NIGHT.key}
        distance={4.4}
        angle={Math.PI / 5.4}
        penumbra={0.82}
        decay={2.2}
        position={[-2.55, DESK_TOP + 0.5, 2.3]}
        target={[-1.3, DESK_TOP - 0.1, 2.05]}
        castShadow
      />

      {/* 해 — 창 밖에서 드는 찬 빛. 방 전체 그림자를 잡는다. */}
      <directionalLight
        ref={at('sun')}
        color={0xaec4e8}
        intensity={NIGHT.sun}
        position={[3.0, 6.2, 1.2]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0016}
      />
      {/* 필 — 그림자 쪽을 살짝 들어 올린다. 그림자를 만들지 않는다. */}
      <directionalLight
        ref={at('fill')}
        color={0x5e8aa8}
        intensity={NIGHT.fill}
        position={[5.5, 3.2, -3.5]}
      />

      {/* 물건이 스스로 내는 빛 — 창·모니터·램프·문 */}
      <pointLight
        ref={at('win')}
        color={0x9db6e8}
        intensity={NIGHT.win}
        distance={5.5}
        decay={1.9}
        position={[2.3, 1.7, 2.85]}
      />
      <pointLight
        ref={at('mon')}
        color={0x58b8e8}
        intensity={NIGHT.mon}
        distance={3.4}
        decay={2.0}
        position={[-1.79, DESK_TOP + 0.34, 2.45]}
      />
      <pointLight
        ref={at('lamp')}
        color={0xe8a87c}
        intensity={NIGHT.lamp}
        distance={2.6}
        decay={2.2}
        position={[-2.32, DESK_TOP + 0.3, 2.62]}
      />
      <pointLight
        ref={at('door')}
        color={0x9fd0e8}
        intensity={NIGHT.door}
        distance={3.2}
        decay={2.2}
        position={[-2.8, 0.35, -0.6]}
      />
      <pointLight
        ref={at('floor')}
        color={0xe89a62}
        intensity={NIGHT.floor}
        distance={3.6}
        decay={2.2}
        position={[-2.7, 1.72, 0.9]}
      />

      {/* 화이트보드 — 벽에 걸린 것을 읽을 수 있게 따로 비춘다. */}
      <Spot
        lightRef={at('board')}
        color={0xdce6f5}
        intensity={NIGHT.board}
        distance={5.2}
        angle={Math.PI / 3.2}
        penumbra={0.85}
        decay={1.7}
        position={[-1.78, 2.86, BACK_WALL_Z - 1.2]}
        target={[-1.78, 1.9, BACK_WALL_Z - 0.09]}
      />

      {/* 회의 구역 천장등 — 없으면 그 구역이 통째로 안 보인다(프로토타입 실측). */}
      <Spot
        lightRef={at('meet')}
        color={0xffd9a8}
        intensity={NIGHT.meet}
        distance={5.2}
        angle={Math.PI / 4.0}
        penumbra={0.72}
        decay={2.0}
        position={[1.2, 2.86, -0.25]}
        target={[1.2, 0.55, -0.25]}
        castShadow
      />
    </>
  )
}

/**
 * 타깃이 있는 스포트라이트.
 *
 * ⚠️ three 의 SpotLight 는 `target` 이 **씬에 들어 있어야** 방향이 잡힌다.
 *    R3F 에서 ref 로 넘기면 첫 렌더에 null 이라 조용히 원점(0,0,0)을 비춘다.
 *    타깃 객체를 조명의 자식으로 두고 좌표를 직접 넣는다.
 */
function Spot({
  target,
  position,
  castShadow = false,
  lightRef,
  ...props
}: {
  lightRef: (l: THREE.Light | null) => void
  color: number
  intensity: number
  distance: number
  angle: number
  penumbra: number
  decay: number
  position: [number, number, number]
  target: [number, number, number]
  castShadow?: boolean
}) {
  return (
    <spotLight
      ref={lightRef}
      {...props}
      position={position}
      castShadow={castShadow}
      shadow-mapSize={[512, 512]}
      shadow-bias={-0.0013}
    >
      {/* 조명의 자식이므로 좌표가 조명 기준이다 — 절대좌표에서 조명 위치를 뺀다. */}
      <object3D
        attach="target"
        position={[target[0] - position[0], target[1] - position[1], target[2] - position[2]]}
      />
    </spotLight>
  )
}
