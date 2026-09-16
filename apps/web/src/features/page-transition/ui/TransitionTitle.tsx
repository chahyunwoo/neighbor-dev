'use client'

import { ENTER, GLYPH_STAGGER } from '@/features/page-transition/lib/transition'
import { useTransition } from '@/features/page-transition/ui/TransitionRoot'
import { SplitText } from '@/shared/ui'

/**
 * 화면의 제목 — 들어올 때 글자가 착지하고, 나갈 때 흩어진다.
 *
 * 🔴 여기가 `shared/ui/SplitText` 와 전환 상태를 잇는 유일한 지점이다.
 *    `SplitText` 는 `phase` 만 받는 순수한 컴포넌트로 둔다 — shared 가
 *    features 의 context 를 알면 FSD 단방향이 깨진다.
 *
 * ⚠️ 서버 컴포넌트인 페이지에서 부를 수 있게 클라이언트 경계를 여기서 긋는다
 *    (`Reveal` 과 같은 이유). 페이지에 `'use client'` 를 붙이면 그 화면 전체가
 *    클라이언트로 넘어가 정적 생성이 깨진다.
 */
export function TransitionTitle({
  text,
  className,
  as = 'h1',
}: {
  text: string
  /** ⚠️ `| undefined` 명시 — `exactOptionalPropertyTypes` (실측 TS2375). */
  className?: string | undefined
  as?: 'h1' | 'h2' | 'p' | 'span'
}) {
  const { phase } = useTransition()
  return (
    <SplitText
      text={text}
      className={className}
      as={as}
      phase={phase === 'exiting' ? 'scatter' : 'show'}
      delay={ENTER.title / 1000}
      stagger={GLYPH_STAGGER}
    />
  )
}
