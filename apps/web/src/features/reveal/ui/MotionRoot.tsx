'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

// reducedMotion="user" 한 곳에서 모든 모션에 적용한다. transform 만 끄고 opacity 는 남긴다.
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
