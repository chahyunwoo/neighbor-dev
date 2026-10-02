'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DEG, type Placement } from '@/entities/room'
import { anchorOf } from './anchors'
import { DEFAULTS, METALNESS, PALETTE, ROUGHNESS } from './layout'
import { reactionOf } from './reaction'
import { useReaction } from './useReaction'

// useGLTF 는 씬을 캐시·공유한다 — 그대로 쓰면 인스턴스가 겹치고 머티리얼이 번진다. clone() 으로 복제한다.
export function Furniture({
  placement,
  openId,
  onAnchor,
}: {
  placement: Placement
  openId?: string | null
  /** 마커 위치를 부모에 알린다. 로드된 씬을 쥔 여기서 재야 부모가 반복문 안에서 훅을 부르지 않는다. */
  onAnchor?: (id: string, at: [number, number, number]) => void
}) {
  const { scene } = useGLTF(`/models/${placement.model}.glb`)
  const ref = useRef<THREE.Object3D>(null)

  const object = useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true
      child.receiveShadow = true

      const src = child.material
      const materials = Array.isArray(src) ? src : [src]
      child.material = materials.map((m) => {
        // 로더가 붙이는 접미사(wood.001)를 자른다 — 안 자르면 조용히 기본값으로 떨어진다.
        const name = (m.name || '').split('.')[0]
        const next = m.clone() as THREE.MeshStandardMaterial
        next.color = new THREE.Color(PALETTE[name] ?? DEFAULTS.color)
        next.metalness = METALNESS[name] ?? DEFAULTS.metalness
        next.roughness = ROUGHNESS[name] ?? DEFAULTS.roughness
        // bloom 이 이 발광을 집는다.
        if (name === 'lamp') {
          next.emissive = new THREE.Color(PALETTE.lamp)
          next.emissiveIntensity = 0.7
        }
        return next
      })
      if (!Array.isArray(src)) child.material = (child.material as THREE.Material[])[0]
    })
    return cloned
  }, [scene])

  const hotspot = placement.hotspot
  useEffect(() => {
    if (!hotspot || !onAnchor) return
    onAnchor(hotspot, anchorOf(placement, scene))
  }, [hotspot, onAnchor, placement, scene])

  const scale: [number, number, number] = Array.isArray(placement.scale)
    ? placement.scale
    : [placement.scale, placement.scale, placement.scale]

  const center = useMemo<[number, number, number]>(() => {
    const c = new THREE.Box3().setFromObject(scene).getCenter(new THREE.Vector3())
    return [c.x * scale[0], c.y * scale[1], c.z * scale[2]]
  }, [scene, scale[0], scale[1], scale[2]])

  useReaction(
    ref,
    { position: placement.position, rotationY: placement.rotationY },
    hotspot ? reactionOf(hotspot) : null,
    hotspot != null && hotspot === openId,
    center,
  )

  return (
    <primitive
      ref={ref}
      object={object}
      position={placement.position}
      rotation={[0, placement.rotationY * DEG, 0]}
      scale={scale}
    />
  )
}
