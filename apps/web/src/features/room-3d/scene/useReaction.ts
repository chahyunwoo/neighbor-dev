import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { DEG } from './layout'
import { poseAt, type Reaction, type Vec3 } from './reaction'

// 물건별 값과 자세 계산은 reaction.ts, 벽·가구 관통 검사는 scripts/verify-reaction.mjs.

function ease(t: number): number {
  return 1 - (1 - t) ** 3
}

const OPEN_MS = 620
const CLOSE_MS = 460

export function useReaction(
  ref: React.RefObject<THREE.Object3D | null>,
  base: { position: readonly [number, number, number]; rotationY: number },
  reaction: Reaction | null,
  open: boolean,
  center: Vec3,
) {
  const anim = useRef({ from: 0, to: 0, start: 0, value: 0 })

  // 목표 변경을 렌더 중에 잡는다 — effect 로 하면 렌더 순서에 따라 한 프레임 튄다.
  const target = open ? 1 : 0
  if (anim.current.to !== target) {
    anim.current = {
      from: anim.current.value,
      to: target,
      start: performance.now(),
      value: anim.current.value,
    }
  }

  useFrame(() => {
    const o = ref.current
    if (!o || !reaction) return
    const a = anim.current
    const ms = a.to === 1 ? OPEN_MS : CLOSE_MS
    const t = Math.min(1, (performance.now() - a.start) / ms)
    a.value = a.from + (a.to - a.from) * ease(t)

    const pose = poseAt(
      { position: base.position, yaw: base.rotationY * DEG },
      reaction,
      a.value,
      center,
    )
    o.position.set(...pose.position)
    o.rotation.y = pose.yaw
  })
}
