'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { useCanRender3D } from '@/shared/lib'

// ssr:false 는 클라이언트 컴포넌트인 여기 있어야 한다 — layout.tsx 는 서버 컴포넌트다. 3D 청크를 초기 번들에 넣지 않는다.
const CanvasShell = dynamic(() => import('./CanvasShell').then((m) => m.CanvasShell), {
  ssr: false,
  loading: () => null,
})

// layout.tsx 의 {children} 밖에 둔다 — 안에 두면 template.tsx 전환 transform 이 fixed 기준을 바꿔 캔버스가 흔들린다.
// 한 번 뜨면 내리지 않고 감추기만 한다(재마운트는 GLTF 재파싱·WebGL 컨텍스트 재생성). 첫 판정이 false 면 아예 안 띄운다.
export function CanvasRoot() {
  const can = useCanRender3D()
  const everOn = useRef(false)
  if (can === true) everOn.current = true

  // can === null(SSR·첫 페인트)이거나 처음부터 false 면 청크를 안 받는다.
  if (!everOn.current) return null

  return <CanvasShell />
}
