'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { daylight } from './daylight'

// 벽은 장식이 아니라 조명의 일부다 — 없으면 빛이 날아가 방이 절반 밝기가 된다.
// 왼쪽 벽은 문 자리를 비운 세 조각이다. 치수는 프로토타입 실측값이라 눈대중으로 고치지 않는다.

/** RW=폭, RD=깊이, WH=벽 높이, (FX,FZ)=바닥 중심. */
const RW = 6.8
const RD = 5.6
const WH = 3.0
const FX = 0.3
const FZ = 0.55

// 문 모델 경계와 같다. 크면 문 둘레 틈으로 배경이 보인다.
const DOOR_Z0 = -2.096
const DOOR_Z1 = -1.1
const DOOR_H = 2.07

/** 밤 기준 색. 낮에는 낮 색으로 비율만큼 섞는다. */
const FLOOR_COLOR = 0x1e1811
const WALL_COLOR = 0x232028
const FLOOR_DAY = new THREE.Color(0x6e7488)
const WALL_DAY = new THREE.Color(0x8e93a8)

/** 방 밖으로 나가는 시선이 검게 떨어지지 않게. */
export const ROOM_BG = 0x0c0b12
export const ROOM_BG_DAY = 0xaeb6c8

export function Shell() {
  const z0 = FZ - RD / 2
  const z1 = FZ + RD / 2
  const leftX = FX - RW / 2

  const floor = useRef<THREE.MeshStandardMaterial>(null)
  const walls = useRef(new Set<THREE.MeshStandardMaterial>())
  const wall = (m: THREE.MeshStandardMaterial | null) => {
    if (m) walls.current.add(m)
  }
  const applied = useRef(daylight.t)
  useFrame(() => {
    if (applied.current === daylight.t) return
    applied.current = daylight.t
    const day = 1 - daylight.t
    floor.current?.color.set(FLOOR_COLOR).lerp(FLOOR_DAY, day * 0.75)
    for (const m of walls.current) m.color.set(WALL_COLOR).lerp(WALL_DAY, day * 0.8)
  })

  return (
    <>
      <mesh position={[FX, -0.05, FZ]} receiveShadow>
        <boxGeometry args={[RW, 0.1, RD]} />
        <meshStandardMaterial ref={floor} color={FLOOR_COLOR} roughness={0.85} metalness={0.02} />
      </mesh>

      <mesh position={[FX, WH / 2, z1]} receiveShadow>
        <boxGeometry args={[RW, WH, 0.12]} />
        <meshStandardMaterial ref={wall} color={WALL_COLOR} roughness={0.96} metalness={0} />
      </mesh>

      {/* 왼쪽 벽 — 문 앞뒤 두 조각과 문 위 인방 */}
      <mesh position={[leftX, WH / 2, (z0 + DOOR_Z0) / 2]} receiveShadow>
        <boxGeometry args={[0.12, WH, DOOR_Z0 - z0]} />
        <meshStandardMaterial ref={wall} color={WALL_COLOR} roughness={0.96} metalness={0} />
      </mesh>
      <mesh position={[leftX, WH / 2, (DOOR_Z1 + z1) / 2]} receiveShadow>
        <boxGeometry args={[0.12, WH, z1 - DOOR_Z1]} />
        <meshStandardMaterial ref={wall} color={WALL_COLOR} roughness={0.96} metalness={0} />
      </mesh>
      <mesh position={[leftX, DOOR_H + (WH - DOOR_H) / 2, (DOOR_Z0 + DOOR_Z1) / 2]} receiveShadow>
        <boxGeometry args={[0.12, WH - DOOR_H, DOOR_Z1 - DOOR_Z0]} />
        <meshStandardMaterial ref={wall} color={WALL_COLOR} roughness={0.96} metalness={0} />
      </mesh>
    </>
  )
}
