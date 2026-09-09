/**
 * shared — 가장 아래 레이어.
 *
 * 🔴 **상위 레이어를 import 하지 않는다**(FSD 단방향 의존). type-only 도 안 된다.
 *    여기 있는 것은 어느 도메인에도 속하지 않아야 한다 — 도메인 지식이 섞이면
 *    그건 `entities` 로 올라가야 하는 신호다.
 */
export { NARROW_QUERY, REDUCED_QUERY, useCanRender3D } from './lib/can-3d'
export { RichText } from './ui/RichText'
