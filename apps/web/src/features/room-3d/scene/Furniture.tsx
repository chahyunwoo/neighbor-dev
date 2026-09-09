'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { anchorOf } from './anchors'
import { DEFAULTS, DEG, METALNESS, PALETTE, type Placement, ROUGHNESS } from './layout'
import { reactionOf, useReaction } from './useReaction'

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
export function Furniture({
  placement,
  openId,
  onAnchor,
}: {
  placement: Placement
  /** 지금 열려 있는 물건. 이 물건이면 반응한다(서랍이 빠지고 문이 열린다). */
  openId?: string | null
  /**
   * 이 물건의 마커 위치를 부모에게 알린다.
   *
   * 🔴 앵커는 **모델을 실제로 재서** 낸다(`anchors.ts`). 그 계산에는 로드된
   *    씬이 필요한데, 그걸 이미 들고 있는 곳이 여기다 — 부모가 따로
   *    로드하면 훅 규칙(반복문 안 훅 호출)을 어기게 된다.
   */
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
        // ⚠️ glTF 로더가 같은 머티리얼을 여러 번 쓰면 `wood.001` 처럼 접미사를
        //    붙인다. 점 앞만 쓴다 — 안 자르면 조용히 기본값으로 떨어진다.
        const name = (m.name || '').split('.')[0]
        const next = m.clone() as THREE.MeshStandardMaterial
        next.color = new THREE.Color(PALETTE[name] ?? DEFAULTS.color)
        next.metalness = METALNESS[name] ?? DEFAULTS.metalness
        next.roughness = ROUGHNESS[name] ?? DEFAULTS.roughness
        // 램프는 스스로 빛난다 — 포스트프로세싱의 bloom 이 이 값을 집는다.
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

  // 🔴 열린 물건은 실제로 움직인다 — 서랍이 빠지고 문이 열린다(`useReaction`).
  //    핫스팟이 없는 가구는 반응하지 않는다(null 이면 훅이 아무것도 안 한다).
  useReaction(
    ref,
    { position: placement.position, rotationY: placement.rotationY },
    hotspot ? reactionOf(hotspot) : null,
    hotspot != null && hotspot === openId,
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
