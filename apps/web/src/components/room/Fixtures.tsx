'use client'

import * as THREE from 'three'
import { DESK_TOP } from './layout'

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

const SCREEN_GLOW = '#4a7cc4'

/** 모니터 — 책상 위, 뒷벽을 등지고 앞을 본다. */
export function Monitor({ position }: { position: [number, number, number] }) {
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
      {/* 화면 — 스스로 빛난다. bloom 이 이 값을 집는다. */}
      <mesh position={[0, 0.52, 0.023]}>
        <planeGeometry args={[0.86, 0.5]} />
        <meshStandardMaterial
          color={SCREEN_GLOW}
          emissive={new THREE.Color(SCREEN_GLOW)}
          emissiveIntensity={1.1}
          roughness={0.3}
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
  return (
    <group position={position} rotation={[0, (rotationY * Math.PI) / 180, 0]}>
      {/* 테두리 — 프로토타입 실측 크기(BW=2.10, BH=1.28). */}
      <mesh castShadow>
        <boxGeometry args={[2.1, 1.28, 0.06]} />
        <meshStandardMaterial color="#2b2f38" roughness={0.55} metalness={0.5} />
      </mesh>
      {/* 판 — 약하게 빛난다. 붙어 있는 것이 있다는 신호다. */}
      <mesh position={[0, 0, 0.034]}>
        <planeGeometry args={[1.98, 1.16]} />
        <meshStandardMaterial
          color="#25303e"
          emissive={new THREE.Color('#25303e')}
          emissiveIntensity={0.45}
          roughness={0.75}
        />
      </mesh>
      {/* 붙어 있는 카드 — 실적이 붙어 있다는 것을 형태로 보여준다. */}
      {[
        [-0.6, 0.34, 0.6, 0.26],
        [0.08, 0.34, 0.64, 0.26],
        [0.72, 0.34, 0.44, 0.26],
        [-0.54, -0.02, 0.7, 0.26],
        [0.28, -0.02, 0.56, 0.26],
        [-0.42, -0.4, 0.5, 0.22],
        [0.24, -0.4, 0.62, 0.22],
      ].map(([x, y, w, h]) => (
        <mesh key={`${x},${y}`} position={[x as number, y as number, 0.038]}>
          <planeGeometry args={[w as number, h as number]} />
          <meshStandardMaterial color="#38465a" roughness={0.85} />
        </mesh>
      ))}
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
