/**
 * 화면 전환의 타이밍 — **이 파일이 유일한 출처다.**
 *
 * 🔴 값을 컴포넌트마다 적지 않는다. `reveal/lib/motion.ts` 가 같은 이유로
 *    만들어졌다(실측 2026-09-09: transition 이 16곳에 제각각이었다).
 *    전환은 DOM·3D·라우터 셋이 같은 시계를 봐야 해서 더 그렇다.
 *
 * 아트디렉션(기획서 4-A): **차갑고 정밀하다.** 통통 튀지 않는다.
 */

/** 나가는 연출의 단계별 시각(ms). 0 = 링크를 누른 순간. */
export const EXIT = {
  /** 제목 글자가 뒤에서부터 위로 흩어지기 시작한다. */
  title: 0,
  /** 본문이 아래로 가라앉으며 흐려진다. */
  body: 180,
  /** 3D 가 뒤로 물러나고 색수차가 벌어진다. */
  scene: 260,
  /**
   * 라우트를 바꾼다.
   *
   * ⚠️ 이 값이 곧 **클릭 후 기다리는 시간**이다. 늘리면 연출은 여유로워지지만
   *    사이트는 느려진다. 그 대기를 프리페치에 쓴다(`TransitionLink`).
   */
  commit: 400,
} as const

/**
 * 들어오는 연출의 단계별 시각(ms). 0 = 새 화면이 마운트된 순간.
 *
 * 🔴 **나가는 쪽보다 짧다.** 같은 길이로 잡으면 빈 화면이 길어져 그냥 느린
 *    사이트가 된다(`reveal/lib/motion.ts` 의 `pageIn` 이 적어둔 것과 같은 규칙).
 *
 *    실측 2026-09-16: 처음엔 title 120 · body 340 이었는데, 스크린샷을 열어 보니
 *    **클릭 후 700ms 시점에 화면이 거의 비어 있었다** — 라우트 전환(400ms)에
 *    본문 지연(340ms)이 그대로 얹혀 1.2초가 걸렸다. 프로브는 통과했다.
 *    자동 지표가 "연출이 돈다" 는 말해도 "기다린다" 는 말해 주지 않는다.
 */
export const ENTER = {
  /** 3D 가 제자리로 밀려들어온다. */
  scene: 0,
  /** 제목 글자가 아래에서 하나씩 착지한다. */
  title: 60,
  /** 본문이 떠오른다. 제목이 다 앉기 전에 시작해 겹친다 — 그래야 안 기다린다. */
  body: 150,
} as const

/** 글자 하나씩의 간격(초). 제목이 길면 끝까지 기다리게 되므로 짧게 잡는다. */
export const GLYPH_STAGGER = 0.04

/**
 * 전환 상태를 담는 DOM 속성 이름.
 *
 * 🔴 **3D 는 이 속성으로만 전환을 안다.** `room-3d` 를 import 하지 않는다 —
 *    features 끼리 엮으면 FSD 단방향 규칙 위반이고 `verify-fsd.mjs` 가 잡는다.
 *    `CanvasMode` 가 `data-canvas-mode` 로 쓰는 방식 그대로다.
 */
export const PHASE_ATTR = 'data-transition'

export type Phase = 'idle' | 'exiting'

/** 지금 나가는 중인가. 3D 쪽에서 매 프레임 읽는다. */
export function isExiting(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute(PHASE_ATTR) === 'exiting'
}
