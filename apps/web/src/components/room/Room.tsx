'use client'

import { Canvas } from '@react-three/fiber'
import dynamic from 'next/dynamic'
import { Suspense, useEffect, useState } from 'react'
import * as THREE from 'three'
import { CAMERA_FOV, CAMERA_POSITION, ROOM_CENTER } from './layout'
import styles from './Room.module.css'

// 🔴 3D 청크를 초기 번들에 넣지 않는다 (기획서 4절 성능 예산).
//    모바일·크롤러는 이 청크를 아예 받지 않는다.
const Scene = dynamic(() => import('./Scene').then((m) => m.Scene), { ssr: false })

/**
 * 3D 를 띄울지 판단한다 (기획서 4절 폴백 3단).
 *
 * | 조건 | 결과 |
 * |---|---|
 * | 데스크톱 | R3F 3D + 포스트프로세싱 |
 * | 좁은 화면 · reduced-motion | 3D 를 띄우지 않는다 → 부모가 목록을 남긴다 |
 * | JS 비활성 · 크롤러 | 이 컴포넌트가 아예 실행되지 않는다 → 서버 렌더 목록 |
 *
 * ⚠️ 실측(프로토타입): 모바일에서 3D 와 목록을 함께 두면 3D 에 남는 세로가
 *    390x844 에서 103px, 390x600 에서는 **-141px** 이다. 공존이 불가능하다.
 *    그래서 "3D 대신 목록" 이지 "3D 위에 목록" 이 아니다.
 */
function useCanRender3D(): boolean | null {
  // null = 아직 모른다(SSR·첫 페인트). 이 동안에는 목록만 보인다.
  const [can, setCan] = useState<boolean | null>(null)

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

  return can
}

/**
 * @param onActive 3D 가 실제로 뜨는지 부모에게 알린다 — 부모는 그때 목록을
 *   접고 카피를 3D 위로 올린다. 판단을 두 곳에서 하지 않기 위해서다.
 */
export function Room({ onActive }: { onActive?: (active: boolean) => void }) {
  const can = useCanRender3D()

  useEffect(() => {
    if (can !== null) onActive?.(can)
  }, [can, onActive])

  if (can !== true) return null

  return (
    <div className={styles.canvas}>
      <Canvas
        // 프로토타입 실측 구도. 값을 바꾸려면 layout.ts 의 주석을 먼저 읽는다.
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
        shadows
        dpr={[1, 2]}
        /*
         * 🔴 톤매핑이 조명의 절반이다. 프로토타입과 같은 조명값을 넣어도
         *    이 설정이 없으면 전혀 다르게 나온다 — 가구가 갈색으로 뭉개진다
         *    (실측 2026-09-09, 프로토타입 스크린샷과 대조해 발견).
         */
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.88,
        }}
        onCreated={({ camera }) => camera.lookAt(...ROOM_CENTER)}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <p className={styles.hint}>드래그해서 둘러보기 · 눌러서 열기</p>
    </div>
  )
}
