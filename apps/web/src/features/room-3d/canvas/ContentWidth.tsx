'use client'

import { useEffect } from 'react'

// 캔버스 폭과 본문 폭을 같은 곳에서 가르려고 <html data-content> 에 둔다. cleanup 에서 지운다 — 남으면 다음 화면에 넓은 폭이 새어 든다.
export function ContentWidth({ wide }: { wide: boolean | undefined }) {
  useEffect(() => {
    if (!wide) return
    document.documentElement.dataset.content = 'wide'
    return () => {
      delete document.documentElement.dataset.content
    }
  }, [wide])

  return null
}
