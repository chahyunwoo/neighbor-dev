'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { useCanRender3D } from '@/shared/lib'

/**
 * 🔴 3D 청크를 초기 번들에 넣지 않는다 (기획서 4절 성능 예산).
 *    모바일·크롤러는 이 청크를 아예 받지 않는다.
 *
 * 🔴 **`ssr:false` 가 여기 있어야 한다.** `app/layout.tsx` 는 서버
 *    컴포넌트라 그 안에서 직접 쓸 수 없다. 클라이언트 컴포넌트를 한 겹
 *    두어 그 안에서 부르는 것이 pmndrs·basement 가 **둘 다** 쓰는 우회다.
 */
const CanvasShell = dynamic(() => import('./CanvasShell').then((m) => m.CanvasShell), {
  ssr: false,
  loading: () => null,
})

/**
 * 앱 전체에서 캔버스를 **한 번만** 마운트한다.
 *
 * 🔴 `app/layout.tsx` 에 두되 `{children}` **밖**에 둔다. 안에 두면
 *    `template.tsx` 의 전환 `transform` 이 `fixed` 의 기준을 바꿔
 *    라우트 전환 620ms 동안 캔버스가 같이 흔들린다.
 *
 * 🔴 **한 번 뜨면 내리지 않는다** (basement 의 sticky mount).
 *    창을 좁혔다 늘렸다 할 때마다 언마운트하면 GLTF 21개를 다시 파싱하고
 *    WebGL 컨텍스트를 새로 만든다 — 브라우저 컨텍스트 상한(보통 16)에
 *    가까워지고 INP 가 무너진다. 좁아지면 **감추기만** 한다
 *    (`data-canvas-mode` 가 'off' 가 되어 `visibility:hidden`).
 *
 *    ⚠️ 단 **첫 판정이 false 면 아예 안 띄운다** — 모바일이 3D 청크를
 *       받지 않는다는 성능 예산이 지켜져야 한다. "한 번 true 였으면 유지"
 *       이지 "언젠가는 띄운다" 가 아니다.
 */
export function CanvasRoot() {
  const can = useCanRender3D()
  const everOn = useRef(false)
  if (can === true) everOn.current = true

  // can === null(SSR·첫 페인트)이거나 처음부터 false 면 청크를 안 받는다.
  if (!everOn.current) return null

  return <CanvasShell />
}
