'use client'

import { ENTER, GLYPH_DURATION, GLYPH_SPAN } from '@/features/page-transition/lib/transition'
import { useNavCount } from '@/features/page-transition/ui/TransitionRoot'
import { SplitText } from '@/shared/ui'

/**
 * 화면의 제목 — **처음 들어온 화면에서만** 글자가 하나씩 착지한다.
 *
 * 🔴 라우트 전환에는 연출을 걸지 않는다. View Transitions 가 화면을 통째로
 *    겹쳐 넘기는데, 그 위에 글자 연출을 얹으면 **VT 가 새 화면을 찍는 58ms
 *    시점에 제목이 투명해** 겹칠 그림이 사라진다(실측 2026-09-16:
 *    320ms·560ms 스크린샷이 비어 있었다). 화면을 잇는 일은 하나가 맡는다.
 *
 * ⚠️ 그래서 `useNavCount()` 가 0 일 때만 쪼갠다 — 이 세션에서 아직 라우트를
 *    갈아탄 적이 없는, 즉 **주소로 바로 들어온 첫 화면**이다.
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
