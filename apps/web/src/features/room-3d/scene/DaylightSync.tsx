'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { daylight, stepDaylight } from './daylight'
import { ROOM_BG, ROOM_BG_DAY } from './Shell'

/** 밤 Bloom 세기. `Scene` 의 `<Bloom intensity>` 와 같아야 한다. */
export const BLOOM_NIGHT = 0.7
/** 램프 전구 발광 — 밤 값은 `Furniture` 의 lamp `emissiveIntensity`. 낮은 프로토타입 비율(0.35 / 2.2). */
const BULB_NIGHT = 0.7
const BULB_DAY = BULB_NIGHT * (0.35 / 2.2)

const BG_NIGHT = new THREE.Color(ROOM_BG)
const BG_DAY = new THREE.Color(ROOM_BG_DAY)

/**
 * 낮/밤 진행도를 매 프레임 한 걸음 옮기고, 조명 밖에서 바뀌는 것(배경·Bloom·램프 전구)을 맞춘다.
 * 광원은 `Lights`, 벽·바닥은 `Shell` 이 같은 `daylight.t` 를 읽는다.
 */
export function DaylightSync({ bloom }: { bloom: React.RefObject<{ intensity: number } | null> }) {
  const scene = useThree((s) => s.scene)
  const bulbs = useRef<THREE.MeshStandardMaterial[]>([])

  useFrame(() => {
    if (!stepDaylight()) return
    const t = daylight.t
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(BG_NIGHT).lerp(BG_DAY, (1 - t) * 0.75)
    }
    if (bloom.current) bloom.current.intensity = BLOOM_NIGHT * (t * 0.75 + 0.25)
    if (bulbs.current.length === 0) {
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m instanceof THREE.MeshStandardMaterial && m.name.split('.')[0] === 'lamp') {
            bulbs.current.push(m)
          }
        }
      })
    }
    for (const m of bulbs.current) m.emissiveIntensity = BULB_DAY + (BULB_NIGHT - BULB_DAY) * t
  })

  return null
}
