'use client'

import { Environment, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { DEFAULTS, DEG, METALNESS, PALETTE, ROUGHNESS } from './layout'
import styles from './ObjectStage.module.css'

/**
 * 물건 하나를 페이지 배경에 세운다 (기획서 4절).
 *
 * 🔴 **방을 열면 그 물건이 화면으로 이어져야 한다.** 이전에는 마커를 눌러
 *    페이지로 오면 3D 가 통째로 사라져 평범한 문서가 됐다 — 홈에만 3D 가
 *    있고 나머지 6개 화면에는 canvas 가 0개였다(실측 2026-09-09).
 *    그러면 "작업실 안에 프로젝트가 산다" 가 첫 화면 장식으로 끝난다.
 *
 * ⚠️ 방 전체를 다시 그리지 않는다. 물건 하나만 띄운다 —
 *    · 페이지마다 방을 통째로 로드하면 번들과 GPU 부담이 6배가 된다
 *    · 본문이 주인공인 화면에서 방이 다 보이면 글이 안 읽힌다
 *
 * ⚠️ 본문 뒤에 깔리므로 **읽기를 방해하면 안 된다.** 오른쪽에 치우쳐 두고
 *    투명도를 낮춘다. 마우스 이벤트도 받지 않는다(`pointer-events: none`).
 */

interface Props {
  /** 띄울 모델 파일명(확장자 제외). `/public/models/<model>.glb` */
  model: string
  /** 모델 자체 회전(도). 물건마다 정면이 다르다. */
  rotationY?: number
  /** 크기 보정. 물건마다 원본 크기가 제각각이다. */
  scale?: number
}

function Piece({ model, rotationY = 0, scale = 1 }: Props) {
  const { scene } = useGLTF(`/models/${model}.glb`)

  const object = useMemo(() => {
    const cloned = scene.clone(true)
    // 방과 같은 리컬러를 쓴다 — 여기만 색이 다르면 같은 물건으로 안 읽힌다.
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const src = child.material
      const materials = Array.isArray(src) ? src : [src]
      child.material = materials.map((m) => {
        const name = (m.name || '').split('.')[0]
        const next = m.clone() as THREE.MeshStandardMaterial
        next.color = new THREE.Color(PALETTE[name] ?? DEFAULTS.color)
        next.metalness = METALNESS[name] ?? DEFAULTS.metalness
        next.roughness = ROUGHNESS[name] ?? DEFAULTS.roughness
        return next
      })
      if (!Array.isArray(src)) child.material = (child.material as THREE.Material[])[0]
    })

    // 원점을 물건 중심으로 옮긴다 — 모델마다 원점이 제각각(대개 바닥)이라
    // 그대로 두면 어떤 것은 화면 밖으로 나간다.
    const box = new THREE.Box3().setFromObject(cloned)
    const center = box.getCenter(new THREE.Vector3())
    cloned.position.sub(center)
    return cloned
  }, [scene])

  return (
    <group rotation={[0, rotationY * DEG, 0]} scale={scale}>
      <primitive object={object} />
    </group>
  )
}

/**
 * 페이지 배경의 3D.
 *
 * 🔴 홈의 `Room` 과 같은 폴백 규칙을 따른다 — 좁은 화면과 reduced-motion
 *    에서는 띄우지 않는다. 판단을 여기서 다시 하지 않고 같은 조건을 쓴다.
 */
export function ObjectStage({ model, rotationY = 0, scale = 1 }: Props) {
  const [can, setCan] = useState(false)

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 900px)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const decide = () => setCan(!narrow.matches && !reduced.matches)
    decide()
    narrow.addEventListener('change', decide)
    reduced.addEventListener('change', decide)
    return () => {
      narrow.removeEventListener('change', decide)
      reduced.removeEventListener('change', decide)
    }
  }, [])

  if (!can) return null

  return (
    <div className={styles.stage} aria-hidden="true">
      <Canvas
        camera={{ position: [3.4, 2.2, 4.2], fov: 34 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
        }}
      >
        <ambientLight intensity={0.5} />
        {/* 램프 쪽에서 오는 따뜻한 빛 — 방의 조명 성격을 잇는다(4-A 절). */}
        <directionalLight position={[4, 6, 3]} intensity={1.5} color="#ffd9b0" />
        <directionalLight position={[-5, 2, -3]} intensity={0.45} color="#6ba3e8" />
        <Suspense fallback={null}>
          <Piece model={model} rotationY={rotationY} scale={scale} />
          <Environment preset="night" />
        </Suspense>
        {/*
         * 천천히 돈다 — 방문자가 손대지 않아도 "살아 있다" 가 보인다.
         * 조작은 막는다(`enabled={false}`): 본문 뒤의 배경이라 여기서
         * 드래그를 받으면 스크롤을 뺏는다.
         */}
        <OrbitControls
          enabled={false}
          autoRotate
          autoRotateSpeed={0.4}
          enablePan={false}
          enableZoom={false}
        />
      </Canvas>
    </div>
  )
}
