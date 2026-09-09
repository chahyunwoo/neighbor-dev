'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * 모션의 접근성 경계.
 *
 * 🔴 `reducedMotion="user"` 한 줄이 **모든 모션에 적용된다.** 컴포넌트마다
 *    `prefers-reduced-motion` 을 다시 읽지 않는다 — 한 곳이라도 빠뜨리면
 *    그 화면만 움직여서, 움직임을 끈 사람에게 오히려 더 나쁘다.
 *
 * ⚠️ 이것은 위치·크기 변화를 끄는 것이지 페이드까지 끄지는 않는다.
 *    Motion 의 규칙이 그렇다 — 어지러움을 만드는 것은 이동이지 투명도가 아니다.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
