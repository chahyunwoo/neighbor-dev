/** 반응 값과 자세 계산. 렌더러가 없는 순수 함수라 검사 스크립트가 그대로 불러 쓴다. */

export type Vec3 = readonly [number, number, number]

export interface Reaction {
  /** 열렸을 때 월드 축으로 옮길 거리. */
  move: Vec3
  /** 열렸을 때 더 돌릴 각도(라디안). */
  turn: number
  /** 회전축. Kenney 모델 원점은 min 코너라 'origin' 은 모서리를 축으로 돈다. */
  pivot: 'origin' | 'center'
}

/** 벽·이웃 가구를 파고들지 않는 범위다. 값을 바꾸면 scripts/verify-reaction.mjs 로 잰다. */
export function reactionOf(hotspot: string): Reaction {
  switch (hotspot) {
    // 서랍은 통짜 모델이라 크게 빼면 가구가 통째로 튀어나온다.
    case 'drawer':
      return { move: [0.07, 0, 0], turn: 0, pivot: 'origin' }
    // 문은 경첩(모서리)을 축으로 돈다.
    case 'door':
      return { move: [0, 0, 0], turn: -Math.PI * 0.46, pivot: 'origin' }
    // 왼쪽 벽에 붙어 있어 돌리면 벽을 뚫는다. 방 안쪽(+x)으로 나온다.
    case 'bookshelf':
      return { move: [0.12, 0, 0], turn: 0, pivot: 'origin' }
    // 의자에 둘러싸여 있어 돌리면 의자를 뚫는다. 위로 뜬다.
    case 'team':
      return { move: [0, 0.08, 0], turn: 0, pivot: 'center' }
    default:
      return { move: [0, 0, 0], turn: Math.PI * 0.08, pivot: 'center' }
  }
}

function yaw(x: number, z: number, a: number): [number, number] {
  return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]
}

/** 진행도 t(0~1)에서의 위치·각도. center 는 스케일을 건 모델 로컬 bbox 중심(pivot center 전용). */
export function poseAt(
  base: { position: Vec3; yaw: number },
  r: Reaction,
  t: number,
  center: Vec3,
): { position: [number, number, number]; yaw: number } {
  const turn = r.turn * t
  let [x, y, z] = base.position
  if (r.pivot === 'center' && turn !== 0) {
    const [vx, vz] = yaw(center[0], center[2], base.yaw)
    const [rx, rz] = yaw(vx, vz, turn)
    x += vx - rx
    z += vz - rz
  }
  return {
    position: [x + r.move[0] * t, y + r.move[1] * t, z + r.move[2] * t],
    yaw: base.yaw + turn,
  }
}
