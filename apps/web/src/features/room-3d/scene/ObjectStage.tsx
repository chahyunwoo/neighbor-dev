'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { CanvasMode } from '@/features/room-3d/canvas/CanvasMode'
import { r3f } from '@/features/room-3d/canvas/tunnel'
import { useCanRender3D } from '@/shared/lib'

// 🔴 홈과 **같은 청크**를 쓴다. 홈을 거쳐 왔으면 이미 받아 둔 것이다.
const Scene = dynamic(() => import('./Scene').then((m) => m.Scene), { ssr: false })

/**
 * 본문 화면의 배경 — **같은 방을, 그 물건 앞에서 본다.**
 *
 * 🔴 **물건 하나만 따로 띄우지 않는다.** 예전에는 그렇게 했는데, 그러면 홈의
 *    방과 페이지의 물건이 **서로 다른 장면**이 되어 화면이 바뀔 때 3D 가 한
 *    프레임에 통째로 갈렸다 — 실측 2026-09-16: `data-canvas-mode` 가 120ms 에
 *    `room` → `object` 로 즉시 바뀌었고, 캔버스 불투명도만 부드럽게 내려갈 뿐
 *    **내용물이 확 바뀌었다.** 사용자 지적: *"자연스럽게 가다가 갑자기 확확
 *    나타나고 확확 바뀐다"*. 크로스페이드로는 못 가린다 — 교체 지점 자체를
 *    없애야 한다.
 *
 *    → 방은 하나다. 화면이 바뀌면 **카메라만** 그 물건 앞으로 간다.
 *
 * 🔴 옛 주석의 "번들·GPU 6배" 는 **재현 명령이 없는 수치였다.** 실측:
 *
 *        du -ck apps/web/public/models/*.glb   →  232 total (KB)
 *
 *    방 전체 GLB 가 232KB 다. 홈을 거쳐 오면 추가 전송은 0 이고, 방을 다
 *    그리는 홈에서 이미 60fps 가 나온다(전환 중 33ms 초과 프레임 0개).
 *
 * ⚠️ 본문 뒤에 깔리므로 **읽기를 방해하면 안 된다.** 오른쪽으로 치우치고
 *    투명해지는 것은 `tokens.css` 의 `html[data-canvas-mode="object"]` 가 한다 —
 *    캔버스가 하나뿐이라 DOM 속성으로 모드를 알린다.
 */
export function ObjectStage({ objectId }: { objectId: string }) {
  // 🔴 판단은 `lib/can-3d.ts` 한 곳에서 한다 — 홈(`Hero`)도 같은 훅을 부른다.
  const can = useCanRender3D() === true

  /*
   * ⚠️ 3D 를 못 쓰는 상황에서도 **모드는 선언한다.** 캔버스가 라우트를 넘어
   *    살아 있으므로, 아무도 말하지 않으면 이전 화면의 3D 가 그대로 남는다.
   */
  if (!can) return <CanvasMode mode="off" />

  return (
    <>
      <CanvasMode mode="object" />
      <r3f.In>
        <Suspense fallback={null}>
          {/*
           * `openId` 로 이 화면의 물건을 지정한다 — `CameraRig` 가 그리로
           * 날아간다. 홈에서 마커를 눌렀을 때와 **같은 경로**다.
           */}
          <Scene mode="page" openId={objectId} seen={EMPTY} onOpen={noop} onEntered={noop} />
        </Suspense>
      </r3f.In>
    </>
  )
}

/** 페이지에서는 "이미 열어본 것" 표시가 없다. 마커 자체를 안 그린다. */
const EMPTY: ReadonlySet<string> = new Set()
function noop() {}
