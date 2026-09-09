'use client'

import { useEffect } from 'react'

export type Mode = 'room' | 'object' | 'off'

/**
 * 이 화면이 캔버스를 어떻게 쓰는지 선언한다.
 *
 * 🔴 **캔버스가 안 죽으므로 각 화면이 자기 모드를 말해야 한다.**
 *    지금까지는 라우트를 떠나면 캔버스가 언마운트되어 자동으로 정리됐다.
 *    지속 캔버스에서는 아무도 말하지 않으면 **이전 라우트의 3D 가 그대로 남는다.**
 *
 * 🔴 `usePathname` 을 쓰지 않는다(basement 와 같은 판단). 경로 문자열로
 *    분기하면 (a) 프리렌더에서 Suspense 경계를 강요당하고 (b) `/work/[id]`
 *    같은 동적 라우트가 늘 때 매칭 표가 라우트와 따로 놀아 조용히 어긋난다.
 *    **각 화면이 직접 선언하는 편이 어긋날 자리가 없다.**
 *
 * ⚠️ cleanup 에서 'off' 로 되돌린다 — 다음 화면이 선언하기 전 한 프레임 동안
 *    이전 3D 가 비치는 것을 막는다.
 */
export function CanvasMode({ mode }: { mode: Mode }) {
  useEffect(() => {
    document.documentElement.dataset.canvasMode = mode
    return () => {
      document.documentElement.dataset.canvasMode = 'off'
    }
  }, [mode])

  return null
}
