import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { DEG } from './layout'

/**
 * 물건을 열면 **실제로 반응한다** (시안 `actOn` · `stepActs`).
 *
 * 🔴 이전 구현은 마커를 눌러도 패널만 바뀌고 **방은 가만히 있었다.**
 *    그러면 3D 가 배경 그림이 되고, "물건을 열면 일이 나온다"(기획서 4절)가
 *    글로만 남는다. 서랍은 빠지고 문은 열려야 방이 만져지는 공간이 된다.
 *
 * 값은 전부 시안 실측이다(CLAUDE.md: 3D 좌표를 눈대중으로 고치지 않는다):
 *
 * | 물건 | 반응 | 값 |
 * |---|---|---|
 * | 서랍 | x 로 살짝 밀린다 | `0.07` |
 * | 현관문 | y 축 회전으로 열린다 | `-0.46π` |
 * | 그 외 | 살짝 기운다 | `+0.10π` |
 *
 * ⚠️ 서랍을 크게 빼지 않는 이유가 시안 주석에 있다 — Kenney 모델은 서랍칸이
 *    분리돼 있지 않은 **통짜**라, 많이 밀면 가구가 통째로 튀어나온다.
 *    그래서 "당겨진 느낌" 만 준다.
 */

/** 시안 easeOutCubic. */
function ease(t: number): number {
  return 1 - (1 - t) ** 3
}

const OPEN_MS = 620
const CLOSE_MS = 460

export interface Reaction {
  /** 원래 자리에서 얼마나 밀 것인가 (로컬 x). */
  slide: number
  /** 원래 각도에서 얼마나 돌 것인가 (라디안). */
  turn: number
}

/** 물건별 반응. 없으면 살짝 기운다. */
export function reactionOf(hotspot: string): Reaction {
  if (hotspot === 'drawer') return { slide: 0.07, turn: 0 }
  if (hotspot === 'door') return { slide: 0, turn: -Math.PI * 0.46 }
  return { slide: 0, turn: Math.PI * 0.1 }
}

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

    o.position.set(base.position[0] + reaction.slide * a.value, base.position[1], base.position[2])
    o.rotation.y = base.rotationY * DEG + reaction.turn * a.value
  })
}
