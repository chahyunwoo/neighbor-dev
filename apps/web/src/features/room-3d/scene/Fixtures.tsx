'use client'

import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { getDetailProjects } from '@/entities/project'
import { DESK_TOP } from './layout'
import { makeBoardTexture, makeScreenTexture } from './textures'

// 모니터는 팩 모델이 화면 메시를 따로 못 빛내서, 화이트보드는 팩에 없어서 직접 만든다.

export function Monitor({ position }: { position: [number, number, number] }) {
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const screen = useMemo(() => makeScreenTexture(maxAnisotropy), [maxAnisotropy])

  return (
    <group position={position} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.03, 0.2]} />
        <meshStandardMaterial color="#22212b" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.17, 0]} castShadow>
        <boxGeometry args={[0.06, 0.28, 0.06]} />
        <meshStandardMaterial color="#2b2f38" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.52, 0]} castShadow>
        <boxGeometry args={[0.92, 0.56, 0.04]} />
        <meshStandardMaterial color="#16151d" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* bloom 이 발광을 집는다. */}
      <mesh position={[0, 0.52, 0.023]}>
        <planeGeometry args={[0.86, 0.5]} />
        <meshStandardMaterial
          map={screen}
          emissiveMap={screen}
          emissive={new THREE.Color('#ffffff')}
          emissiveIntensity={0.62}
          roughness={0.34}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

export function Whiteboard({
  position,
  rotationY = 0,
}: {
  position: [number, number, number]
  rotationY?: number
}) {
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const board = useMemo(() => {
    // 지어낸 카드를 붙이지 않는다 — 화이트보드가 여는 목록의 실제 데이터다.
    const projects = getDetailProjects()
    return makeBoardTexture(
      maxAnisotropy,
      projects.map((p) => ({ label: p.label, period: p.period })),
      projects.length,
    )
  }, [maxAnisotropy])

  return (
    <group position={position} rotation={[0, (rotationY * Math.PI) / 180, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.1, 1.28, 0.06]} />
        <meshStandardMaterial color="#2b2f38" roughness={0.55} metalness={0.5} />
      </mesh>
      {/* 판은 방 쪽(-z)을 향하게 Y 180° 돌린다 — 안 돌리면 뒷면이라 빈 판만 보인다. */}
      <mesh position={[0, 0, -0.034]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.98, 1.16]} />
        <meshStandardMaterial
          map={board}
          emissiveMap={board}
          emissive={new THREE.Color('#ffffff')}
          emissiveIntensity={0.34}
          roughness={0.72}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

// 프로토타입 실측값이다. 눈대중으로 바꾸지 않는다 — 화이트보드는 왼쪽 벽이 아니라 뒷벽에 건다.
export const MONITOR_POSITION: [number, number, number] = [-1.79, DESK_TOP, 2.62]
export const WHITEBOARD_POSITION: [number, number, number] = [-1.78, 1.9, 3.26]
export const WHITEBOARD_ROTATION_Y = 0

/** DaylightSync 가 이 이름으로 전구를 찾는다. */
export const PENDANT_BULB = 'pendantBulb'
/** Shell 의 WH 와 같아야 한다. */
const CEILING_Y = 3.0

/** 회의 테이블 위 천장 펜던트 — 누르면 불을 켜고 끈다. Lights 의 회의등과 같은 자리에 매단다. */
export function Pendant({
  position,
  onPick,
}: {
  position: [number, number, number]
  onPick?: (() => void) | undefined
}) {
  const cord = CEILING_Y - position[1] - 0.11
  return (
    <group
      position={position}
      {...(onPick && {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          onPick()
        },
        onPointerOver: () => {
          document.body.style.cursor = 'pointer'
        },
        onPointerOut: () => {
          document.body.style.cursor = ''
        },
      })}
    >
      <mesh position={[0, 0.11 + cord / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, cord, 8]} />
        <meshStandardMaterial color={0x2a2e36} roughness={0.8} />
      </mesh>
      {/* 안쪽이 보이게 양면 */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <coneGeometry args={[0.3, 0.24, 26, 1, true]} />
        <meshStandardMaterial
          color={0x2e3440}
          roughness={0.5}
          metalness={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.075, 18, 14]} />
        <meshStandardMaterial
          name={PENDANT_BULB}
          color={0xffe0b8}
          roughness={0.35}
          emissive={0xffc98a}
          emissiveIntensity={2.2}
        />
      </mesh>
    </group>
  )
}
