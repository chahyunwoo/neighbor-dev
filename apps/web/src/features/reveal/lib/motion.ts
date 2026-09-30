import type { Transition, Variants } from 'motion/react'
import { EASE } from '@/shared/lib'

// 모션 값은 전부 여기서 온다 — 컴포넌트마다 따로 적지 않는다. 튀는 스프링 없이 감속 곡선으로 멈춘다.

export const DURATION = {
  tap: 0.14,
  quick: 0.28,
  base: 0.52,
  page: 0.62,
} as const

/** 목록이 하나씩 들어올 때의 간격. */
export const STAGGER = 0.055

export const transition = (d: number = DURATION.base): Transition => ({
  duration: d,
  ease: EASE,
})

// 이동 거리를 크게 잡지 않는다 — 멀리서 날아오면 시선이 이동을 쫓느라 내용을 놓친다.
export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: transition() },
}

export const stagger = (delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: STAGGER, delayChildren: delay },
  },
})

// 화면 사이 전환은 View Transitions 가 맡는다. 여기는 스크롤 등장용이다.

// once — 다시 나타나면 읽던 자리를 잃는다. amount 0.15 — 다 보일 때까지 기다리면 읽던 글이 늦게 뜬다.
export const inView = { once: true, amount: 0.15 } as const
