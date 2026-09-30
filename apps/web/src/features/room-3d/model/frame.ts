// 3D 가 보이는 영역(뷰포트 px). 캔버스는 뷰포트 전체로 고정하고 이 영역만 clip-path 로 드러낸다 — 캔버스를 줄이면 전환 중 매 프레임 버퍼를 다시 만든다.
export const frame = { x: 0, y: 0, w: 0, h: 0 }

let last = ''

export function readFrame(): typeof frame {
  const el = document.querySelector('.canvas-frame')
  if (!el) return frame
  const r = el.getBoundingClientRect()
  frame.x = r.x
  frame.y = r.y
  frame.w = r.width
  frame.h = r.height
  const key = `${r.x}|${r.y}|${r.width}|${r.height}`
  if (key !== last) {
    last = key
    const shell = document.querySelector<HTMLElement>('.canvas-shell')
    if (shell) {
      shell.style.setProperty('--cf-x', `${r.x}px`)
      shell.style.setProperty('--cf-y', `${r.y}px`)
      shell.style.setProperty('--cf-w', `${r.width}px`)
      shell.style.setProperty('--cf-h', `${r.height}px`)
      shell.style.setProperty('--cf-r', `${document.documentElement.clientWidth - r.right}px`)
      shell.style.setProperty('--cf-b', `${document.documentElement.clientHeight - r.bottom}px`)
    }
  }
  return frame
}
