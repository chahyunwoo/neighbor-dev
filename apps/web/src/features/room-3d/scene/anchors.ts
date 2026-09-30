import * as THREE from 'three'
import { DEG, type Placement } from './layout'

// 마커는 bbox 중심 위, 실제 꼭대기 + LIFT 에 단다 — 배치 원점에 고정값을 더하면 물건 높이마다 어긋난다. 보정은 LIFT 만 만진다.

export const LIFT = 0.22

/** scene 은 useGLTF 원본이어도 된다 — 복제해 크기만 잰다. */
export function anchorOf(placement: Placement, scene: THREE.Object3D): [number, number, number] {
  // 배치와 같은 변환을 걸어야 실제 화면 크기가 나온다.
  const probe = scene.clone(true)
  const s = Array.isArray(placement.scale)
    ? placement.scale
    : ([placement.scale, placement.scale, placement.scale] as [number, number, number])
  probe.scale.set(...s)
  probe.rotation.set(0, placement.rotationY * DEG, 0)
  probe.position.set(...placement.position)
  probe.updateMatrixWorld(true)

  const bb = new THREE.Box3().setFromObject(probe)
  // 빈 상자(모델이 아직 없음)면 배치 좌표로 물러난다 — 마커가 사라지느니 낫다.
  if (!Number.isFinite(bb.max.y)) return placement.position

  return [(bb.min.x + bb.max.x) / 2, bb.max.y + LIFT, (bb.min.z + bb.max.z) / 2]
}

/** 직접 만든 고정물(모니터·화이트보드)처럼 이미 크기를 아는 것. */
export function anchorFromBox(
  center: readonly [number, number, number],
  halfHeight: number,
): [number, number, number] {
  return [center[0], center[1] + halfHeight + LIFT, center[2]]
}
