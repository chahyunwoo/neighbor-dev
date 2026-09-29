import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { DEG } from './layout'
import { poseAt, type Reaction, type Vec3 } from './reaction'

/**
 * 물건을 열면 **실제로 반응한다** (시안 `actOn` · `stepActs`).
 *
 * 🔴 이전 구현은 마커를 눌러도 패널만 바뀌고 **방은 가만히 있었다.**
 *    그러면 3D 가 배경 그림이 되고, "물건을 열면 일이 나온다"(기획서 4절)가
 *    글로만 남는다. 서랍은 빠지고 문은 열려야 방이 만져지는 공간이 된다.
 *
 * 물건별 값과 자세 계산은 `reaction.ts` 에 있다. 벽·가구 관통은 `scripts/verify-reaction.mjs` 가 잰다.
 */

/** 시안 easeOutCubic. */
function ease(t: number): number {
  return 1 - (1 - t) ** 3
}

const OPEN_MS = 620
const CLOSE_MS = 460

/**
 * 열림 상태에 따라 물건을 움직인다.
 *
 * @param ref 움직일 객체
 * @param base 원래 위치·각도(배치값)
 * @param open 지금 열려 있는가
 */
export function useReaction(
  ref: React.RefObject<THREE.Object3D | null>,
  base: { position: readonly [number, number, number]; rotationY: number },
  reaction: Reaction | null,
  open: boolean,
  center: Vec3,
) {
  const anim = useRef({ from: 0, to: 0, start: 0, value: 0 })

  // 목표가 바뀌면 새 구간을 연다. `useFrame` 안에서 비교하므로 effect 가 없다 —
  // effect 로 하면 렌더 순서에 따라 한 프레임 튄다.
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
