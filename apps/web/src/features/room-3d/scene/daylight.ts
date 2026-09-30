/** 낮/밤 진행도. t 는 1 이 밤(기본), 0 이 낮. 조명·벽·배경·Bloom 이 매 프레임 읽는다. */
export const daylight = { t: 1, from: 1, to: 1, start: 0 }

/** 낮의 광원 배수 — 배수가 서로 멀면 한 광원만 뒤늦게 들어오는 것처럼 보인다. */
export const DAY_MUL = {
  key: 0.42,
  lamp: 0.4,
  mon: 0.55,
  board: 0.44,
  door: 0.42,
  meet: 0.44,
  floor: 0.4,
  sun: 2.4,
  win: 2.1,
  fill: 1.9,
  ambient: 3.2,
  hemi: 2.8,
} as const

const MS = 1100

export function setDaylightTarget(night: boolean) {
  const to = night ? 1 : 0
  if (to === daylight.to) return
  daylight.from = daylight.t
  daylight.to = to
  daylight.start = performance.now()
}

/** 목표로 한 걸음 옮긴다(스무스스텝). 값이 바뀌었으면 true. */
export function stepDaylight(): boolean {
  if (daylight.t === daylight.to) return false
  const u = Math.min(1, (performance.now() - daylight.start) / MS)
  const e = u * u * (3 - 2 * u)
  daylight.t = u >= 1 ? daylight.to : daylight.from + (daylight.to - daylight.from) * e
  return true
}

/** 밤 세기에 낮 배수를 진행도만큼 섞는다. */
export function mixDay(night: number, dayMul: number): number {
  const t = daylight.t
  return night * (t + (1 - t) * dayMul)
}
