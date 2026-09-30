// 화면 전환 타이밍의 유일한 출처 — 컴포넌트마다 값을 적지 않는다. 나가는 쪽 길이는 tokens.css 의 ::view-transition-old 에 있다.

export const ENTER = {
  // 0 — TransitionTitle 은 VT 가 없는 첫 로드에서만 쪼개므로 기다릴 대상이 없다.
  title: 0,
} as const

/** 제목 글자 전체의 총 시간(초). 간격을 고정하면 긴 제목이 끝없이 느려진다. */
export const GLYPH_SPAN = {
  in: 0.3,
  /** 글자가 적을 때의 간격 상한. */
  maxStep: 0.045,
} as const

/** 낱글자 하나가 착지하는 데 걸리는 시간(초). */
export const GLYPH_DURATION = { in: 0.46 } as const
