'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { ENTER, EXIT } from '@/features/page-transition/lib/transition'
import { useTransition } from '@/features/page-transition/ui/TransitionRoot'

/**
 * 제목 아래의 본문 — 나갈 때 가라앉으며 흐려지고, 들어올 때 떠오른다.
 *
 * 🔴 제목보다 **늦게 나가고 늦게 들어온다**(`EXIT.body` 180ms · `ENTER.body` 340ms).
 *    같이 움직이면 화면 전체가 한 판때기로 미끄러져, 우리가 피하려던 그 흔한
 *    슬라이드가 된다. 시차가 있어야 글자가 따로 논다는 것이 읽힌다.
 *
 * ⚠️ 이동 거리를 작게 잡는다(10px). `reveal/lib/motion.ts` 의 `rise` 가 14px 인
 *    것과 같은 이유다 — 멀리서 날아오면 시선이 이동을 쫓느라 내용을 놓친다.
 *
 * ⚠️ `blur` 는 값이 크면 GPU 를 많이 먹는다. 3D 가 같은 프레임에서 돌고 있으므로
 *    4px 을 넘기지 않는다.
 */
export function TransitionBody({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  /** ⚠️ `| undefined` 명시 — `exactOptionalPropertyTypes` (실측 TS2375). */
  className?: string | undefined
  /**
   * 감싸면서 원래 태그를 유지한다.
   *
   * ⚠️ 이게 없으면 `<p className={styles.fig}>` 같은 것을 감쌀 때 `div` 가
   *    끼어들어 레이아웃이 바뀐다. 실제로 그래서 캡션·빵부스러기를 못 감쌌고,
   *    **그 둘만 선명하게 남아 혼자 떠 있었다**(스크린샷으로 발견 — 자동
   *    지표로는 안 잡힌다).
   */
  as?: 'div' | 'p' | 'section'
}) {
  const { phase } = useTransition()
  const exiting = phase === 'exiting'
  const Tag = motion[as]

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      animate={
        exiting
          ? { opacity: 0, y: 10, filter: 'blur(4px)' }
          : { opacity: 1, y: 0, filter: 'blur(0px)' }
      }
      transition={{
        duration: exiting ? 0.24 : 0.5,
        delay: exiting ? EXIT.body / 1000 : ENTER.body / 1000,
        ease: [0.22, 0.61, 0.36, 1],
      }}
    >
      {children}
    </Tag>
  )
}
