'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { inView, rise, stagger } from '@/features/reveal/lib/motion'

// 서버 컴포넌트 페이지에서 부를 수 있게 클라이언트 경계를 여기서 긋는다. reduced-motion 은 MotionConfig 가 처리한다.
// delay prop 을 두지 않는다 — rise.show 의 transition 이 이긴다. 차례가 필요하면 RevealGroup 을 쓴다.
export function Reveal({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  // exactOptionalPropertyTypes 때문에 `| undefined` 를 명시한다.
  className?: string | undefined
  as?: 'div' | 'section' | 'li' | 'article'
}) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      variants={rise}
    >
      {children}
    </Tag>
  )
}

/** 자식들이 차례로 들어온다. 자식은 RevealItem 이어야 variants 를 받는다. */
export function RevealGroup({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode
  // exactOptionalPropertyTypes 때문에 `| undefined` 를 명시한다.
  className?: string | undefined
  delay?: number
  as?: 'div' | 'section' | 'ul' | 'ol'
}) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      variants={stagger(delay)}
    >
      {children}
    </Tag>
  )
}

/** `RevealGroup` 안의 한 칸. */
export function RevealItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  // exactOptionalPropertyTypes 때문에 `| undefined` 를 명시한다.
  className?: string | undefined
  as?: 'div' | 'li' | 'article' | 'section'
}) {
  const Tag = motion[as]
  return (
    <Tag className={className} variants={rise}>
      {children}
    </Tag>
  )
}
