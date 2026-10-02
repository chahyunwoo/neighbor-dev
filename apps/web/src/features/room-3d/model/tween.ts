/** 프레임 전환 길이(ms). 프레임·투영 보정·라우트 비행이 같이 쓴다. */
export const FRAME_MS = 440

export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export interface Clock {
  start: number
  ms: number
}

export interface Tween extends Clock {
  from: number
  to: number
}

const at = (tw: Tween, now: number) =>
  tw.from + (tw.to - tw.from) * ease(Math.min(1, (now - tw.start) / tw.ms))

// 재목표는 늘 보이는 값에서 다시 출발한다 — 출발점·진행도를 남긴 채 to 만 바꾸면 그 프레임에 튄다.
export function stepShift(
  now: number,
  value: number,
  tween: Tween | null,
  target: number,
  frame: Clock | null,
  frameIsNew: boolean,
): { value: number; tween: Tween | null } {
  let v = tween ? at(tween, now) : value
  let tw = tween && now - tween.start < tween.ms ? tween : null
  if (target !== (tw?.to ?? v)) {
    // 프레임 전환이 이번 틱에 시작됐으면 그 시계를, 절반 넘게 남았으면 그 끝을 같이 쓴다.
    const left = frame ? frame.start + frame.ms - now : 0
    tw =
      frame && frameIsNew
        ? { from: v, to: target, start: frame.start, ms: frame.ms }
        : left > FRAME_MS / 2
          ? { from: v, to: target, start: now, ms: left }
          : { from: v, to: target, start: now, ms: FRAME_MS }
    v = at(tw, now)
  }
  if (tw && now - tw.start >= tw.ms) tw = null
  return { value: v, tween: tw }
}
