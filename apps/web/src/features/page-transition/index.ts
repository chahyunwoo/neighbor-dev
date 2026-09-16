/**
 * page-transition — 화면이 바뀔 때의 연출.
 *
 * 🔴 **나가는 연출은 우리가 만들지 않는다.** View Transitions API 가 이전
 *    화면을 스냅샷으로 잡아 새 화면과 겹쳐 준다(`TransitionRoot`). 손으로
 *    만든 exit 는 두 화면을 겹치지 못해 "끊고 다시 시작" 이 된다.
 *
 * 왜 features 인가: 백엔드 엔드포인트가 없고 UI·흐름만 다룬다
 *    (CLAUDE.md 의 판정 기준 — `reveal` 과 같은 층).
 */
/*
 * ⚠️ 타이밍 상수(`ENTER`·`GLYPH_*`)는 내보내지 않는다 — 슬라이스 안에서만
 *    쓴다. 안 쓰는 것을 배럴에 두면 "누가 쓰나" 를 매번 다시 세게 된다.
 */
export { TransitionBody } from './ui/TransitionBody'
export { TransitionRoot, useNavCount } from './ui/TransitionRoot'
export { TransitionTitle } from './ui/TransitionTitle'
