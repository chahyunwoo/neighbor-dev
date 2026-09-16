'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { EASE, ENTER } from '@/features/page-transition/lib/transition'

/**
 * 제목 아래의 본문 — 들어올 때 떠오른다.
 *
 * 🔴 **나가는 연출은 없다.** View Transitions 가 이전 화면을 통째로 겹쳐
 *    빼 준다(`TransitionRoot`). 손으로 만든 exit 는 겹치지 못하고 순차가 되어
 *    "끊고 다시 시작" 으로 보였다.
 *
 * 🔴 제목보다 **늦게 들어온다**(`ENTER.body`). 같이 움직이면 화면 전체가 한
 *    판때기로 올라와, 우리가 피하려던 그 흔한 슬라이드가 된다.
 *
 * ⚠️ 이동 거리를 작게 잡는다(10px). `reveal/lib/motion.ts` 의 `rise` 가 14px 인
 *    것과 같은 이유 — 멀리서 날아오면 시선이 이동을 쫓느라 내용을 놓친다.
 */
export function TransitionBody({
  children,
  className,
  as = 'div',
  enter = true,
}: {
  children: ReactNode
  /** ⚠️ `| undefined` 명시 — `exactOptionalPropertyTypes` (실측 TS2375). */
  className?: string | undefined
  /**
   * 감싸면서 원래 태그를 유지한다.
   *
   * ⚠️ 이게 없으면 `<p className={styles.fig}>` 같은 것을 감쌀 때 `div` 가
   *    끼어들어 레이아웃이 바뀐다.
   */
  as?: 'div' | 'p' | 'section'
  /**
   * 들어올 때 연출할 것인가.
   *
   * 🔴 홈은 `false` 다. 거기엔 이미 자체 입장 연출이 있고(카메라 비행 +
   *    `data-lit` 페이드), 그 위에 또 얹으면 같은 것이 두 번 움직인다.
   */
  enter?: boolean
}) {
  const Tag = motion[as]
  if (!enter) return <Tag className={className}>{children}</Tag>

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: ENTER.body / 1000, ease: EASE }}
    >
      {children}
    </Tag>
  )
}
