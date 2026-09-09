'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { inView, rise, stagger } from '../lib/motion'

/**
 * 스크롤로 들어올 때 나타난다.
 *
 * 🔴 이 사이트에는 **등장 모션이 아예 없었다.** 글도 카드도 처음부터 다 떠
 *    있어서, 3D 로 공간을 만들어 놓고 정작 그 안의 내용은 정지 화면이었다.
 *
 * ⚠️ 서버 컴포넌트인 페이지에서 부를 수 있게 클라이언트 경계를 여기서 긋는다.
 *    페이지마다 `'use client'` 를 붙이면 그 페이지 전체가 클라이언트로
 *    넘어가고, 정적 생성(기획서 8절)이 깨진다.
 *
 * ⚠️ `prefers-reduced-motion` 은 Motion 이 알아서 존중한다(`MotionConfig` 를
 *    루트에 걸었다) — 여기서 다시 판단하지 않는다.
 *
 * ⚠️ `transition` 을 `undefined` 로 넘기지 않고 값이 있을 때만 편다 —
 *    `exactOptionalPropertyTypes` 가 켜져 있어 거부한다(실측 TS2375).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  /** 늦게 들어와야 할 때. 남용하면 기다리게 된다. */
  delay?: number
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
      {...(delay ? { transition: { delay } } : {})}
    >
      {children}
    </Tag>
  )
}

/**
 * 자식들이 차례로 들어온다.
 *
 * 목록·카드 묶음에 쓴다. 자식은 `RevealItem` 이어야 한다 —
 * 일반 요소를 넣으면 variants 를 못 받아 그냥 나타난다.
 */
export function RevealGroup({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode
  className?: string
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
  className?: string
  as?: 'div' | 'li' | 'article' | 'section'
}) {
  const Tag = motion[as]
  return (
    <Tag className={className} variants={rise}>
      {children}
    </Tag>
  )
}
