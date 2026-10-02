'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { DESK_TOP } from '@/entities/room'
import { DAY_MUL, daylight, mixDay } from './daylight'

// 프로토타입의 11개 등 그대로다. 눈대중으로 줄이지 않는다 — 줄이면 가구가 갈색으로 뭉개지고 회의 구역이 안 보인다.
// 톤매핑(CanvasShell 의 ACESFilmic + exposure)이 없으면 같은 값이 전혀 다르게 나온다.

/** 프로토타입의 FZ + RD/2 와 같다. */
const BACK_WALL_Z = 3.35

/** 밤(기본) 세기. 낮에는 DAY_MUL 을 곱한다. */
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
      {/* 이것만으로는 아무것도 안 보인다. */}
      <ambientLight ref={at('ambient')} color={0x39415a} intensity={NIGHT.ambient} />
      <hemisphereLight
        ref={at('hemi')}
        color={0x6e82a8}
        groundColor={0x1a140e}
        intensity={NIGHT.hemi}
      />

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
      <directionalLight
        ref={at('fill')}
        color={0x5e8aa8}
        intensity={NIGHT.fill}
        position={[5.5, 3.2, -3.5]}
      />

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

      {/* 회의 구역 천장등 — 없으면 그 구역이 통째로 안 보인다. */}
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

// SpotLight target 은 씬에 있어야 방향이 잡힌다 — ref 로 넘기면 첫 렌더에 null 이라 원점을 비춘다. 자식으로 두고 좌표를 넣는다.
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
      {/* 자식이라 조명 기준 좌표다. */}
      <object3D
        attach="target"
        position={[target[0] - position[0], target[1] - position[1], target[2] - position[2]]}
      />
    </spotLight>
  )
}
