'use client'

import { useEffect, useState } from 'react'

// 3D 를 띄울지의 유일한 판단 지점. SSR·첫 페인트는 null — useSyncExternalStore 로 바꾸면 hydration mismatch 가 난다.
// 두 쿼리는 Hero.module.css·page.module.css 의 미디어쿼리와 같은 값이어야 한다.
export const NARROW_QUERY = '(max-width: 900px)'
export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

let webgl: boolean | undefined

// WebGL 이 없는 환경(끈 브라우저·일부 가상 머신)은 목록으로 간다. 컨텍스트 생성은 비싸서 한 번만 잰다.
function hasWebGL(): boolean {
  if (webgl === undefined) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2')
      webgl = gl !== null
      // 판정용 컨텍스트는 바로 놓는다 — 브라우저당 컨텍스트 수에 상한이 있다.
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      webgl = false
    }
  }
  return webgl
}

export function useCanRender3D(): boolean | null {
  // null = 아직 모른다(SSR·첫 페인트). 이 동안에는 목록만 보인다.
  const [can, setCan] = useState<boolean | null>(null)

  useEffect(() => {
    const narrow = window.matchMedia(NARROW_QUERY)
    const reduced = window.matchMedia(REDUCED_QUERY)
    const decide = () => setCan(hasWebGL() && !narrow.matches && !reduced.matches)
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
