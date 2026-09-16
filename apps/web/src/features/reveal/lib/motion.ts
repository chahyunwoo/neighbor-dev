import type { Transition, Variants } from 'motion/react'
import { EASE } from '@/shared/lib'

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

/*
 * 🔴 감속 곡선은 `@/shared/lib` 에서 온다 — 여기서 선언하지 않는다.
 *    `shared/ui/SplitText` 가 FSD 상 이 파일을 import 할 수 없어 같은 값을
 *    리터럴로 다시 박아 쓰고 있었다. 근거는 `shared/lib/easing.ts` 주석.
 *    `EASE_IN_OUT` 은 소비처가 0 이라 지웠다(필요해지면 easing.ts 에 넣는다).
 */

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

/*
 * 🔴 **화면 전환용 variant(`pageIn`·`fade`)는 둘 다 없앴다.**
 *
 *    `pageIn` 은 화면 전체를 y 10px 밀어 올렸다 — 피하려던 "허접한 슬라이딩"
 *    이고, 100dvh 화면에서는 스크롤바까지 깜빡였다(이슈 #24).
 *    `fade` 는 그 뒤 `template.tsx` 가 쓰다가 **서버 HTML 을 통째로
 *    `opacity:0` 으로 만드는** 문제로 걷어냈다(그 파일 주석에 실측이 있다).
 *
 *    화면 사이를 잇는 일은 View Transitions 하나가 맡는다
 *    (`shared/styles/tokens.css` 의 `::view-transition-*`).
 *    여기 남은 것들은 **스크롤 등장**용이다 — 역할이 다르다.
 */

/**
 * 스크롤로 들어올 때 쓰는 공통 옵션.
 *
 * ⚠️ `once: true` — 한 번 보이면 끝이다. 스크롤을 올렸다 내릴 때마다 다시
 *    나타나면 읽던 자리를 잃는다.
 * ⚠️ `amount: 0.15` — 요소가 조금만 보여도 시작한다. 다 보일 때까지 기다리면
 *    이미 읽고 있는 글이 뒤늦게 나타난다.
 */
export const inView = { once: true, amount: 0.15 } as const
