'use client'

import { useEffect, useState } from 'react'

/**
 * 3D 를 띄울지 판단한다 — **이 프로젝트에서 유일한 판단 지점** (기획서 4절 폴백 3단).
 *
 * | 조건 | 결과 |
 * |---|---|
 * | 데스크톱 | R3F 3D + 포스트프로세싱 |
 * | 좁은 화면 · reduced-motion | 3D 를 띄우지 않는다 → 목록이 남는다 |
 * | JS 비활성 · 크롤러 | 이 훅이 아예 실행되지 않는다 → 서버 렌더 목록 |
 *
 * 🔴 이전에는 `Room.tsx` 와 `ObjectStage.tsx` 가 **각각** 미디어쿼리를 읽었고
 *    판정 타입도 달랐다(`boolean|null` vs `boolean`). 캔버스가 layout 으로
 *    올라가면 두 곳이 어긋난 순간 "3D 도 목록도 없는 화면" 이 생긴다.
 *
 * 🔴 **`null` 을 유지한다** (= 아직 모른다: SSR·첫 페인트).
 *    서버 HTML 은 항상 3D 없는 상태로 나가야 크롤러가 목록을 받는다.
 *    ⚠️ `useSyncExternalStore` 로 바꾸지 마라 — 클라이언트 첫 렌더가 바로
 *       true 가 되어 hydration mismatch 가 난다.
 *
 * ⚠️ `NARROW_QUERY` 는 `ObjectStage`/`PageShell` 쪽 CSS 안전망
 *    (`@media (max-width:900px)`)과 **같은 값이어야 한다.**
 */
export const NARROW_QUERY = '(max-width: 900px)'
export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export function useCanRender3D(): boolean | null {
  // null = 아직 모른다(SSR·첫 페인트). 이 동안에는 목록만 보인다.
  const [can, setCan] = useState<boolean | null>(null)

  useEffect(() => {
    const narrow = window.matchMedia(NARROW_QUERY)
    const reduced = window.matchMedia(REDUCED_QUERY)
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
