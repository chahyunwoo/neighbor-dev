'use client'

import { ENTER, GLYPH_DURATION, GLYPH_SPAN } from '@/features/page-transition/lib/transition'
import { SplitText } from '@/shared/ui'

/**
 * 화면의 제목 — 글자가 아래에서 하나씩 착지한다.
 *
 * 🔴 **나가는 연출은 없다.** View Transitions 가 이전 화면을 통째로 겹쳐
 *    빼 주므로(`TransitionRoot`), 여기서 또 흩뜨리면 같은 것이 두 번 움직인다.
 *    전에는 흩어짐까지 손으로 만들었고 그게 "뚜둑뚜둑" 의 절반이었다.
 *
 * ⚠️ 서버 컴포넌트인 페이지에서 부를 수 있게 클라이언트 경계를 여기서 긋는다
 *    (`Reveal` 과 같은 이유).
 */
export function TransitionTitle({
  text,
  className,
  as = 'h1',
  delayMs = 0,
}: {
  text: string
  /** ⚠️ `| undefined` 명시 — `exactOptionalPropertyTypes` (실측 TS2375). */
  className?: string | undefined
  as?: 'h1' | 'h2' | 'p' | 'span'
  /**
   * 이만큼 더 늦게 시작한다(ms).
   *
   * ⚠️ 제목이 두 줄로 나뉜 화면(홈의 `들어와서 / 둘러보세요.`)에서 쓴다.
   *    두 조각이 각각 0 부터 시작하면 **동시에** 움직여 한 줄처럼 보인다.
   */
  delayMs?: number
}) {
  return (
    <SplitText
      text={text}
      className={className}
      as={as}
      delay={(ENTER.title + delayMs) / 1000}
      span={GLYPH_SPAN.in}
      maxStep={GLYPH_SPAN.maxStep}
      duration={GLYPH_DURATION.in}
    />
  )
}
