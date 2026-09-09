import * as THREE from 'three'
import { DEG, type Placement } from './layout'

/**
 * 마커를 물건의 **실제 꼭대기**에 단다.
 *
 * 🔴 이전 구현은 배치 원점(`placement.position`)에 고정값 `+0.85` 를 더했다.
 *    배치 원점은 대개 모델의 **바닥**이고 물건마다 높이가 다르므로, 책장처럼
 *    큰 것과 서랍처럼 낮은 것에 같은 값을 쓰면 어긋난다 — 실측 2026-09-09:
 *    화이트보드 마커가 허공에, 모니터 마커가 화이트보드 위에, 책장 마커가
 *    모니터 쪽에 떠 있었다(스크린샷을 눈으로 보고 발견).
 *
 * 시안(Main.dc.html)이 쓴 방법을 그대로 옮긴다:
 *
 * ```js
 * const bb = new THREE.Box3().setFromObject(obj)
 * anchors[k] = new Vector3((bb.min.x+bb.max.x)/2, bb.max.y + .22, (bb.min.z+bb.max.z)/2)
 * ```
 *
 * 즉 **좌우·앞뒤는 중심, 위는 실제 꼭대기 + 여유**다. 이러면 물건 크기가
 * 달라도 마커가 항상 그 물건 바로 위에 붙는다.
 *
 * ⚠️ 눈대중으로 보정값을 넣지 않는다(CLAUDE.md). 값을 바꿔야 하면
 *    아래 `LIFT` 하나만 만지고, 왜 바꿨는지 실측 근거를 남긴다.
 */

/** 꼭대기에서 얼마나 띄울지. 시안 실측값. */
export const LIFT = 0.22

/**
 * 배치 하나의 마커 위치를 낸다.
 *
 * @param scene `useGLTF` 가 준 원본 씬. 복제본이 아니어도 된다 —
 *   크기만 재고 화면에는 넣지 않는다.
 */
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
