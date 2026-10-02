// 캔버스는 뷰포트 전체이고, 현재 frame 만 clip-path 로 드러낸다.
export const frame = { x: 0, y: 0, w: 0, h: 0 }
export const targetFrame = { ...frame }
export const FRAME_MS = 440
export let frameMotion: { start: number; ms: number } | null = null

export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

let from = { ...frame }
let viewport = { w: 0, h: 0 }
let measured = false
let last = ''

export function readFrame(): typeof frame {
  const root = document.documentElement
  const now = performance.now()
  if (frameMotion) {
    const t = Math.min(1, (now - frameMotion.start) / frameMotion.ms)
    const e = ease(t)
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      frame[k] = from[k] + (targetFrame[k] - from[k]) * e
    }
    if (t >= 1) frameMotion = null
  }

  // 라우트 교체 사이 off 의 전체 뷰포트를 목표로 읽으면 왕복 트윈이 생긴다.
  const el = root.dataset.canvasMode === 'off' ? null : document.querySelector('.canvas-frame')
  if (el) {
    const r = el.getBoundingClientRect()
    const next = { x: r.x, y: r.y, w: r.width, h: r.height }
    // clientWidth 는 라우트마다 스크롤바가 생기고 사라지며 바뀐다 — 그걸 리사이즈로 읽으면 전환이 스냅된다.
    const resized = viewport.w !== window.innerWidth || viewport.h !== window.innerHeight
    if (!measured || resized || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Object.assign(frame, next)
      Object.assign(targetFrame, next)
      frameMotion = null
    } else if (
      Object.keys(next).some(
        (k) => next[k as keyof typeof next] !== targetFrame[k as keyof typeof next],
      )
    ) {
      // 트윈 중 목표가 바뀌면 보이는 값에서 다시 출발한다 — 목표만 바꾸면 되돌아가는 전환이 한 프레임에 튄다.
      from = { ...frame }
      frameMotion = { start: now, ms: FRAME_MS }
      Object.assign(targetFrame, next)
    }
    measured = true
    viewport = { w: window.innerWidth, h: window.innerHeight }
  }

  const key = `${frame.x}|${frame.y}|${frame.w}|${frame.h}|${root.clientWidth}|${root.clientHeight}`
  if (key !== last) {
    const shell = document.querySelector<HTMLElement>('.canvas-shell')
    if (shell) {
      last = key
      shell.style.setProperty('--cf-x', `${frame.x}px`)
      shell.style.setProperty('--cf-y', `${frame.y}px`)
      shell.style.setProperty('--cf-w', `${frame.w}px`)
      shell.style.setProperty('--cf-h', `${frame.h}px`)
      shell.style.setProperty('--cf-r', `${root.clientWidth - frame.x - frame.w}px`)
      shell.style.setProperty('--cf-b', `${root.clientHeight - frame.y - frame.h}px`)
    }
  }
  return frame
}
