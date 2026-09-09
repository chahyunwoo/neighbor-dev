'use client'

import { useEffect } from 'react'

/**
 * 이 화면의 본문이 넓은지를 `<html data-content>` 로 알린다 (이슈 #8).
 *
 * 🔴 **캔버스 폭과 본문 폭은 같은 곳에서 갈려야 한다.** 캔버스는 앱 전체에
 *    하나뿐이고 `<html>` 밑 다른 가지에 있어서, 페이지 쪽 클래스를
 *    `:has()` 로 봐도 `<html>` 의 변수는 안 바뀐다 — 실제로 그렇게 짰다가
 *    본문만 넓어져 209px 이 다시 겹쳤다(실측 2026-09-09).
 *
 * ⚠️ `CanvasMode` 와 같은 규칙이다 — cleanup 에서 지운다. 안 지우면 다음
 *    화면이 좁은 본문인데 넓은 폭 설정이 남는다.
 */
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
