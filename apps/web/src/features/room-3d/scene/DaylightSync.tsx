'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { daylight, stepDaylight } from './daylight'
import { PENDANT_BULB } from './Fixtures'
import { ROOM_BG, ROOM_BG_DAY } from './Shell'

/** 밤 Bloom 세기. `Scene` 의 `<Bloom intensity>` 와 같아야 한다. */
export const BLOOM_NIGHT = 0.7
/** 전구 발광 [밤, 낮]. 스탠드류는 Furniture 의 0.7 에 펜던트와 같은 비율. */
const PENDANT_GLOW = [2.2, 0.35] as const
const LAMP_GLOW = [0.7, 0.7 * (0.35 / 2.2)] as const

const BG_NIGHT = new THREE.Color(ROOM_BG)
const BG_DAY = new THREE.Color(ROOM_BG_DAY)

/** 낮/밤 진행도를 한 걸음 옮기고 배경·Bloom·전구를 맞춘다. 광원은 Lights, 벽·바닥은 Shell 이 같은 daylight.t 를 읽는다. */
export function DaylightSync({ bloom }: { bloom: React.RefObject<{ intensity: number } | null> }) {
  const scene = useThree((s) => s.scene)
  const bulbs = useRef<[THREE.MeshStandardMaterial, readonly [number, number]][]>([])

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
          if (!(m instanceof THREE.MeshStandardMaterial)) continue
          if (m.name === PENDANT_BULB) bulbs.current.push([m, PENDANT_GLOW])
          else if (m.name.split('.')[0] === 'lamp') bulbs.current.push([m, LAMP_GLOW])
        }
      })
    }
    for (const [m, [night, day]] of bulbs.current) m.emissiveIntensity = day + (night - day) * t
  })

  return null
}
