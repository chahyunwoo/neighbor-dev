'use client'

import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { METALNESS, PALETTE, type Placement, ROUGHNESS } from './layout'

const DEG = Math.PI / 180

/**
 * Kenney 가구 하나.
 *
 * 🔑 리컬러는 **머티리얼 이름**으로 한다. 이 팩은 텍스처가 0개이고 색이 전부
 *    `baseColorFactor` 숫자값이라 이름만으로 팩 전체를 다크로 바꿀 수 있다 —
 *    그것이 이 팩을 고른 결정적 이유다(기획서 4절).
 *
 * ⚠️ `useGLTF` 는 씬을 캐시해서 **여러 곳이 같은 객체를 공유한다.** 그대로
 *    쓰면 의자 4개가 한 자리에 겹치고, 머티리얼을 고치면 다른 인스턴스까지
 *    바뀐다. `clone()` 으로 인스턴스마다 복제한다.
 */
export function Furniture({ placement }: { placement: Placement }) {
  const { scene } = useGLTF(`/models/${placement.model}.glb`)

  const object = useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true
      child.receiveShadow = true

      const src = child.material
      const materials = Array.isArray(src) ? src : [src]
      child.material = materials.map((m) => {
        const name = m.name
        const next = m.clone() as THREE.MeshStandardMaterial
        // 실측(2026-09-09): 45개 슬롯 중 43개가 이름으로 잡힌다.
        // 남는 `_defaultMat` 2개도 팔레트에 있으므로 전부 리컬러된다.
        const color = PALETTE[name]
        if (color !== undefined) next.color = new THREE.Color(color)
        next.metalness = METALNESS[name] ?? 0
        next.roughness = ROUGHNESS[name] ?? 0.9
        // 램프는 스스로 빛난다 — 포스트프로세싱의 bloom 이 이 값을 집는다.
        if (name === 'lamp') {
          next.emissive = new THREE.Color(PALETTE.lamp)
          next.emissiveIntensity = 1.4
        }
        return next
      })
      if (!Array.isArray(src)) child.material = (child.material as THREE.Material[])[0]
    })
    return cloned
  }, [scene])

  const scale: [number, number, number] = Array.isArray(placement.scale)
    ? placement.scale
    : [placement.scale, placement.scale, placement.scale]

  return (
    <primitive
      object={object}
      position={placement.position}
      rotation={[0, placement.rotationY * DEG, 0]}
      scale={scale}
    />
  )
}
