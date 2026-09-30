'use client'

import { ENTER, GLYPH_DURATION, GLYPH_SPAN } from '@/features/page-transition/lib/transition'
import { useNavCount } from '@/features/page-transition/ui/TransitionRoot'
import { SplitText } from '@/shared/ui'

// 주소로 바로 들어온 첫 화면에서만 글자를 쪼갠다 — 라우트 전환에서 쪼개면 VT 가 찍을 제목이 투명해진다.
export function TransitionTitle({
  text,
  className,
  as = 'h1',
  delayMs = 0,
}: {
  text: string
  // exactOptionalPropertyTypes 때문에 `| undefined` 를 명시한다.
  className?: string | undefined
  as?: 'h1' | 'h2' | 'p' | 'span'
  /** 두 줄로 나뉜 제목에서 뒷조각을 늦게 시작시킨다(ms). */
  delayMs?: number
}) {
  const first = useNavCount() === 0

  return (
    <SplitText
      text={text}
      className={className}
      as={as}
      animate={first}
      delay={(ENTER.title + delayMs) / 1000}
      span={GLYPH_SPAN.in}
      maxStep={GLYPH_SPAN.maxStep}
      duration={GLYPH_DURATION.in}
    />
  )
}
