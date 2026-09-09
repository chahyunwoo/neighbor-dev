import type { Transition, Variants } from 'motion/react'

/**
 * 모션 규격 — 이 사이트의 움직임은 전부 여기서 온다.
 *
 * 🔴 값을 컴포넌트마다 따로 적지 않는다. 흩어지면 화면마다 속도와 곡선이
 *    달라져 "만들다 만 것" 처럼 보인다 — 실측 2026-09-09: 모션 라이브러리가
 *    0개였고 transition 이 16곳에 제각각 흩어져 있었다.
 *
 * 아트디렉션(기획서 4-A)이 여기에도 적용된다: **화면은 차갑고 정밀하다.**
 * 통통 튀는 스프링을 쓰지 않는다. 감속 곡선으로 조용히 멈춘다.
 */

/** 기본 감속 — 대부분의 등장·전환에 쓴다. */
export const EASE = [0.22, 0.61, 0.36, 1] as const
/** 들어오고 나가는 것이 대칭이어야 할 때. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const

export const DURATION = {
  /** 눌렀을 때의 즉각 반응. */
  tap: 0.14,
  /** 작은 요소의 등장·사라짐. */
  quick: 0.28,
  /** 문단·카드 등장. */
  base: 0.52,
  /** 화면 전환. */
  page: 0.62,
} as const

/** 목록이 하나씩 들어올 때의 간격. 너무 길면 기다리게 된다. */
export const STAGGER = 0.055

export const transition = (d: number = DURATION.base): Transition => ({
  duration: d,
  ease: EASE,
})

/**
 * 아래에서 올라오며 나타난다. 이 사이트의 기본 등장.
 *
 * ⚠️ 이동 거리를 크게 잡지 않는다(14px). 멀리서 날아오면 시선이 그 이동을
 *    쫓느라 내용을 놓친다 — 정보를 읽히려고 만든 화면이다.
 */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: transition() },
}

/** 자식들을 차례로 들여보낸다. 부모에 건다. */
export const stagger = (delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: STAGGER, delayChildren: delay },
  },
})

/** 페이드만. 위치가 바뀌면 안 되는 것(3D 위의 겹침 등)에 쓴다. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition(DURATION.quick) },
}

/**
 * 화면 전환 — 나가는 쪽과 들어오는 쪽.
 *
 * 🔴 나갈 때를 들어올 때보다 짧게 잡는다. 같은 길이면 빈 화면이 길어져
 *    "느리다" 로 느껴진다.
 */
export const pageIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: transition(DURATION.page) },
  exit: { opacity: 0, y: -6, transition: transition(DURATION.quick) },
}

/**
 * 스크롤로 들어올 때 쓰는 공통 옵션.
 *
 * ⚠️ `once: true` — 한 번 보이면 끝이다. 스크롤을 올렸다 내릴 때마다 다시
 *    나타나면 읽던 자리를 잃는다.
 * ⚠️ `amount: 0.15` — 요소가 조금만 보여도 시작한다. 다 보일 때까지 기다리면
 *    이미 읽고 있는 글이 뒤늦게 나타난다.
 */
export const inView = { once: true, amount: 0.15 } as const
