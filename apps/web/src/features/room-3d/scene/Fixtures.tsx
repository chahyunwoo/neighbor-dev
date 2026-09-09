'use client'

import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { getDetailProjects } from '@/entities/project'
import { DESK_TOP } from './layout'
import { makeBoardTexture, makeScreenTexture } from './textures'

/**
 * Kenney 팩에 없거나 못 쓰는 것을 직접 만든다.
 *
 * · **모니터** — 팩의 `computerScreen` 은 화면 메시가 본체와 뭉쳐 있어
 *   화면만 따로 빛나게 할 수 없다(프로토타입 실측). 박스 3개로 만든다.
 * · **화이트보드** — 팩에 없다. 기획서 4절이 "`<boxGeometry>` 3개로 30줄"
 *   이라고 미리 적어둔 그대로다.
 *
 * 둘 다 **주 동선(배지 1·2)** 이라 빠지면 안 된다.
 */

/** 모니터 — 책상 위, 뒷벽을 등지고 앞을 본다. */
export function Monitor({ position }: { position: [number, number, number] }) {
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const screen = useMemo(() => makeScreenTexture(maxAnisotropy), [maxAnisotropy])

  return (
    <group position={position} rotation={[0, Math.PI, 0]}>
      {/* 받침 */}
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.03, 0.2]} />
        <meshStandardMaterial color="#22212b" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* 목 */}
      <mesh position={[0, 0.17, 0]} castShadow>
        <boxGeometry args={[0.06, 0.28, 0.06]} />
        <meshStandardMaterial color="#2b2f38" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* 베젤 */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <boxGeometry args={[0.92, 0.56, 0.04]} />
        <meshStandardMaterial color="#16151d" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* 화면 — 실제 내용이 켜져 있다. bloom 이 발광을 집는다. */}
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

/** 화이트보드 — 왼쪽 벽에 건다. */
export function Whiteboard({
  position,
  rotationY = 0,
}: {
  position: [number, number, number]
  rotationY?: number
}) {
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const board = useMemo(() => {
    // 🔴 실제 데이터다. 지어낸 카드를 붙이지 않는다 — 화이트보드가 여는 것과
    //    같은 목록에서 앞의 여섯 건을 가져온다.
    const projects = getDetailProjects()
    return makeBoardTexture(
      maxAnisotropy,
      projects.map((p) => ({ label: p.label, period: p.period })),
      projects.length,
    )
  }, [maxAnisotropy])

  return (
    <group position={position} rotation={[0, (rotationY * Math.PI) / 180, 0]}>
      {/* 테두리 — 프로토타입 실측 크기(BW=2.10, BH=1.28). */}
      <mesh castShadow>
        <boxGeometry args={[2.1, 1.28, 0.06]} />
        <meshStandardMaterial color="#2b2f38" roughness={0.55} metalness={0.5} />
      </mesh>
      {/*
       * 판 — 실제 실적이 카드로 붙어 있다.
       *
       * 🔴 **방 쪽(-z)을 향한다.** 뒷벽에 걸린 보드이므로 카메라(z 음수)에서
       *    보이려면 판이 -z 로 나오고 Y축으로 180° 돌아야 한다. 안 돌리면
       *    뒷면을 보게 되어 빈 판만 보인다(실측 2026-09-09).
       *    프로토타입 주석도 같다 — "캔버스가 방을 향하게".
       */}
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

/**
 * 두 고정물의 위치 — 프로토타입 실측값.
 *
 * ⚠️ **눈대중으로 정하지 않는다.** 처음에 감으로 넣었더니 화이트보드가
 *    왼쪽 벽(-2.86)에 붙어 카메라 반대편으로 갔고, 모니터는 각도가 안 맞아
 *    화면 뒷면이 파란 판으로 보였다(실측 2026-09-09, 스크린샷으로 확인).
 *
 * 근거:
 *   · 모니터 — 프로토타입의 발광 조명이 (-1.79, DESK_TOP+0.34, 2.45) 에 있다.
 *     본체는 그 바로 뒤(z 를 조금 더 벽 쪽으로)에 선다.
 *   · 화이트보드 — `board.position.set(-1.78, 1.90, FZ+RD/2-0.09)`,
 *     FZ=0.55 · RD=5.6 이므로 z=3.26. **뒷벽**이지 왼쪽 벽이 아니다.
 */
export const MONITOR_POSITION: [number, number, number] = [-1.79, DESK_TOP, 2.62]
export const WHITEBOARD_POSITION: [number, number, number] = [-1.78, 1.9, 3.26]
/** 뒷벽에 걸리므로 회전이 없다. */
export const WHITEBOARD_ROTATION_Y = 0
