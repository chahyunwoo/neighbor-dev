import type { Placement, ROOM_SHELL } from './layout'
import type { Accent, RoomObject } from './room'

// 3D 와 같은 배치를 평행 투영한 2D 평면 방. 방위각은 3D 기본 카메라에서 가져와 같은 쪽에서 본 방으로 읽히게 한다.
// 데이터는 인자로 받는다 — node 테스트가 확장자 없는 import 를 못 풀고, 고정값이 끼어들면 테스트가 잡게 하려는 것이다.

export type Vec3 = readonly [number, number, number]
export type Point = readonly [number, number]

/** 아이소메트릭 내려다보는 각(atan(1/√2)). 카메라 실제 각(약 26°)은 바닥이 납작해 좁은 화면에서 핀이 몰린다. */
const ELEVATION = Math.atan(1 / Math.SQRT2)

/** 가장자리 핀이 잘리지 않게 방 둘레에 두는 여백(m). */
const MARGIN = 0.45

export interface View {
  eye: Vec3
  target: Vec3
}

/** 화면 오른쪽 u, 아래 v. 시선 방향으로 먼 점일수록 위로 올라간다. */
export function projectIso([x, y, z]: Vec3, { eye, target }: View): Point {
  const dx = target[0] - eye[0]
  const dz = target[2] - eye[2]
  const len = Math.hypot(dx, dz)
  const fx = dx / len
  const fz = dz / len
  const u = -fz * x + fx * z
  const depth = fx * x + fz * z
  const v = -(y * Math.cos(ELEVATION) + depth * Math.sin(ELEVATION))
  return [u, v]
}

export interface PlanSource {
  view: View
  layout: readonly Placement[]
  /** 배치 목록 밖에서 직접 만드는 고정물(모니터·화이트보드)의 중심. */
  fixtures: Readonly<Record<string, Vec3>>
  objects: readonly RoomObject[]
  shell: typeof ROOM_SHELL
}

export interface PlanPin {
  no: number
  id: string
  name: string
  href: string
  accent: Accent
  u: number
  v: number
}

/** 핀이 서는 3D 좌표 — 배치 원점 또는 고정물 중심. */
export function hotspotPositions(src: Pick<PlanSource, 'layout' | 'fixtures'>): Map<string, Vec3> {
  const at = new Map<string, Vec3>(Object.entries(src.fixtures))
  for (const p of src.layout) if (p.hotspot) at.set(p.hotspot, p.position)
  return at
}

export function planPins(src: PlanSource): PlanPin[] {
  const at = hotspotPositions(src)
  return src.objects.map((o) => {
    const p = at.get(o.id)
    if (!p) throw new Error(`방 배치에 ${o.id} 자리가 없다`)
    const [u, v] = projectIso(p, src.view)
    return { no: o.no, id: o.id, name: o.name, href: o.href, accent: o.accent, u, v }
  })
}

export interface PlanShape {
  floor: Point[]
  backWall: Point[]
  leftWall: Point[]
  door: Point[]
  /** 바닥·벽 전체 + 여백. SVG viewBox 와 같은 [minU, minV, width, height]. */
  viewBox: readonly [number, number, number, number]
}

export function planShape({ shell, view }: Pick<PlanSource, 'shell' | 'view'>): PlanShape {
  const { RW, RD, WH, FX, FZ, DOOR_Z0, DOOR_Z1, DOOR_H } = shell
  const x0 = FX - RW / 2
  const x1 = FX + RW / 2
  const z0 = FZ - RD / 2
  const z1 = FZ + RD / 2
  const pr = (pts: Vec3[]) => pts.map((p) => projectIso(p, view))

  const floor = pr([
    [x0, 0, z0],
    [x1, 0, z0],
    [x1, 0, z1],
    [x0, 0, z1],
  ])
  const backWall = pr([
    [x0, 0, z1],
    [x1, 0, z1],
    [x1, WH, z1],
    [x0, WH, z1],
  ])
  const leftWall = pr([
    [x0, 0, z0],
    [x0, 0, z1],
    [x0, WH, z1],
    [x0, WH, z0],
  ])
  const door = pr([
    [x0, 0, DOOR_Z0],
    [x0, 0, DOOR_Z1],
    [x0, DOOR_H, DOOR_Z1],
    [x0, DOOR_H, DOOR_Z0],
  ])

  const all = [...floor, ...backWall, ...leftWall]
  const us = all.map((p) => p[0])
  const vs = all.map((p) => p[1])
  const minU = Math.min(...us) - MARGIN
  const minV = Math.min(...vs) - MARGIN
  return {
    floor,
    backWall,
    leftWall,
    door,
    viewBox: [minU, minV, Math.max(...us) + MARGIN - minU, Math.max(...vs) + MARGIN - minV],
  }
}
