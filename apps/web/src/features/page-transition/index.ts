/**
 * page-transition — 화면이 바뀔 때의 연출.
 *
 * 🔴 **3D 는 여기를 import 하지 않는다.** `room-3d` 는 `data-transition` 속성만
 *    읽는다(`lib/transition.ts` 의 `PHASE_ATTR`). features 끼리 엮으면 FSD
 *    단방향 규칙 위반이고 `verify-fsd.mjs` 가 잡는다.
 *
 * 왜 features 인가: 백엔드 엔드포인트가 없고 UI·흐름만 다룬다
 *    (CLAUDE.md 의 판정 기준 — `reveal` 과 같은 층).
 */

export type { Phase } from './lib/transition'
export { ENTER, EXIT, isExiting, PHASE_ATTR } from './lib/transition'
export { TransitionBody } from './ui/TransitionBody'
export { TransitionRoot, useTransition } from './ui/TransitionRoot'
export { TransitionTitle } from './ui/TransitionTitle'
