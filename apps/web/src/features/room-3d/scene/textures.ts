import * as THREE from 'three'

// 화면 텍스처는 한 번만 그린다(성능 예산). 축소 시 글자가 뭉개지므로 밉맵 + 이방성 필터를 켠다.

/** 발광용이라 tokens.css 계열보다 조금 더 밝다. */
const INK = {
  bg: '#0a1220',
  bar: '#152238',
  accent: '#4a9ce8',
  amber: '#e8a87c',
  line: '#22304a',
  dim: '#7e8ca6',
  text: '#c3cede',
} as const

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d 컨텍스트를 얻지 못했다')
  return { canvas, ctx }
}

function toTexture(canvas: HTMLCanvasElement, maxAnisotropy: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = maxAnisotropy
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function makeScreenTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const W = 1024
  const H = 620
  const { canvas, ctx: g } = makeCanvas(W, H)

  g.fillStyle = INK.bg
  g.fillRect(0, 0, W, H)

  g.fillStyle = INK.bar
  g.fillRect(0, 0, W, 64)
  g.fillStyle = INK.accent
  g.font = '600 22px ui-monospace, monospace'
  g.fillText('deploy · pipeline', 26, 41)
  for (const [i, c] of ['#e86b6b', '#e8c46b', '#6be88a'].entries()) {
    g.fillStyle = c
    g.beginPath()
    g.arc(W - 34 - i * 28, 32, 7, 0, Math.PI * 2)
    g.fill()
  }

  const stages = ['기획', '설계', '구현', '테스트', '배포']
  const done = 3
  const cy = 190
  const x0 = 92
  const gap = (W - 184) / (stages.length - 1)

  for (let i = 0; i < stages.length - 1; i++) {
    const a = x0 + i * gap
    const b = x0 + (i + 1) * gap
    g.strokeStyle = i < done - 1 ? INK.accent : INK.line
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(a, cy)
    g.lineTo(b, cy)
    g.stroke()
  }

  stages.forEach((label, i) => {
    const x = x0 + i * gap
    const isActive = i === done
    const isDone = i < done
    g.beginPath()
    g.arc(x, cy, isActive ? 26 : 21, 0, Math.PI * 2)
    g.fillStyle = isActive ? INK.amber : isDone ? INK.accent : '#1b2a42'
    g.fill()
    g.strokeStyle = isActive ? '#f0c4a0' : isDone ? '#6bb6f0' : '#2e4162'
    g.lineWidth = 3
    g.stroke()
    if (isDone) {
      g.strokeStyle = INK.bg
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(x - 8, cy)
      g.lineTo(x - 2, cy + 7)
      g.lineTo(x + 9, cy - 7)
      g.stroke()
    }
    g.fillStyle = isActive ? '#f2d9c4' : INK.dim
    g.font = '500 21px system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText(label, x, cy + 58)
    g.textAlign = 'left'
  })

  g.fillStyle = 'rgba(255,255,255,0.03)'
  g.fillRect(60, 320, W - 120, 230)
  g.strokeStyle = INK.line
  g.lineWidth = 2
  g.strokeRect(60, 320, W - 120, 230)

  g.fillStyle = INK.text
  g.font = '500 22px system-ui, sans-serif'
  g.fillText('단계별 설계 판단', 86, 362)
  g.strokeStyle = INK.line
  g.beginPath()
  g.moveTo(86, 382)
  g.lineTo(W - 86, 382)
  g.stroke()

  g.fillStyle = INK.dim
  g.font = '400 19px ui-monospace, monospace'
  for (const [i, line] of [
    '· 목업과 실 API 의 경계를 한 곳에 몬다',
    '· 도메인 단위로 API·쿼리키·훅을 한 벌씩',
    '· 전환할 때 화면 코드는 손대지 않는다',
  ].entries()) {
    g.fillText(line, 86, 418 + i * 34)
  }

  g.fillStyle = INK.amber
  g.font = '500 18px ui-monospace, monospace'
  g.fillText('클릭해서 전체 보기 →', 86, 528)

  return toTexture(canvas, maxAnisotropy)
}

// 캔버스 글자는 공개 검사기가 못 본다 — getDetailProjects() 처럼 이미 검사를 거친 데이터만 넣고 새 문자열을 짓지 않는다.
export function makeBoardTexture(
  maxAnisotropy: number,
  items: { label: string; period: string }[],
  total: number,
): THREE.CanvasTexture {
  const W = 1200
  const H = 730
  const { canvas, ctx: g } = makeCanvas(W, H)

  g.fillStyle = '#1e2430'
  g.fillRect(0, 0, W, H)

  g.fillStyle = '#e7e9ee'
  g.font = '600 34px system-ui, sans-serif'
  g.fillText('수행 사례', 52, 66)
  const titleW = g.measureText('수행 사례').width
  g.fillStyle = INK.dim
  g.font = '400 22px ui-monospace, monospace'
  g.fillText(`${total}건`, 52 + titleW + 16, 66)

  g.strokeStyle = 'rgba(255,255,255,0.09)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(52, 92)
  g.lineTo(W - 52, 92)
  g.stroke()

  const cardW = (W - 52 * 2 - 26) / 2
  const cardH = 108
  items.slice(0, 6).forEach((item, i) => {
    const x = 52 + (i % 2) * (cardW + 26)
    const y = 124 + Math.floor(i / 2) * (cardH + 22)
    g.fillStyle = '#28313f'
    g.fillRect(x, y, cardW, cardH)
    g.strokeStyle = 'rgba(255,255,255,0.08)'
    g.lineWidth = 2
    g.strokeRect(x, y, cardW, cardH)

    g.fillStyle = INK.amber
    g.font = '400 17px ui-monospace, monospace'
    g.fillText(item.period, x + 20, y + 32)

    g.fillStyle = '#dfe4ec'
    g.font = '500 21px system-ui, sans-serif'
    // 넘치면 옆 카드를 침범한다.
    let label = item.label
    while (g.measureText(label).width > cardW - 40 && label.length > 4) {
      label = label.slice(0, -1)
    }
    if (label !== item.label) label = `${label.slice(0, -1)}…`
    g.fillText(label, x + 20, y + 68)
  })

  g.fillStyle = INK.dim
  g.font = '400 18px ui-monospace, monospace'
  g.fillText('클릭해서 전체 보기 →', 52, H - 34)

  return toTexture(canvas, maxAnisotropy)
}
