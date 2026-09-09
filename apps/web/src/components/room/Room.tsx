'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect } from 'react'
import { CanvasMode } from '../canvas/CanvasMode'
import { r3f } from '../canvas/tunnel'

// 🔴 3D 청크를 초기 번들에 넣지 않는다 (기획서 4절 성능 예산).
//    모바일·크롤러는 이 청크를 아예 받지 않는다.
const Scene = dynamic(() => import('./Scene').then((m) => m.Scene), { ssr: false })

/**
 * 작업실을 지속 캔버스에 실어 보낸다.
 *
 * 🔴 **여기에 `<Canvas>` 가 없다.** 캔버스는 `app/layout.tsx` 에 하나뿐이고
 *    (`components/canvas/CanvasShell.tsx`) 라우트가 바뀌어도 안 죽는다.
 *    이전에는 캔버스가 이 컴포넌트 안에 있어서, 방을 나가면 3D 가 통째로
 *    사라지고 돌아올 때 GLTF 21개를 다시 파싱했다.
 *
 * 🔴 3D 가부는 **부모(`Hero`)가 판단해 `active` 로 내려준다.** 판단 자체는
 *    `lib/can-3d.ts` 한 곳에서만 한다 — 이전에는 이 파일과 `ObjectStage` 가
 *    각각 미디어쿼리를 읽어 어긋날 자리가 있었다.
 *
 * ⚠️ 카메라·조명·컨트롤·이펙트는 전부 `Scene` 안(= tunnel 의 In 쪽)에 있다.
 *    캔버스는 그것들을 모른다 — 홈과 페이지가 하나도 안 겹치기 때문이다.
 */
export function Room({
  active,
  openId,
  seen,
  onOpen,
  onEntered,
}: {
  /** 3D 를 띄울 상황인가. 판단은 `Hero` 가 `useCanRender3D()` 로 한다. */
  active: boolean
  /**
   * 🔴 상태는 **부모(Hero)가 쥔다.** 왼쪽 번호 목록과 3D 마커가 같은 상태를
   *    봐야 하기 때문이다 — 여기서 들고 있으면 목록이 "지금 어디인지" 를 모른다.
   */
  openId: string | null
  seen: ReadonlySet<string>
  onOpen: (id: string) => void
  onEntered: () => void
}) {
  /*
   * 패널이 열리면 캔버스를 왼쪽으로 좁힌다.
   *
   * 🔴 실측 2026-09-09: 패널을 그냥 얹었더니 **마커 2개(서랍·현관문)가 패널
   *    뒤로 숨었다.** 열린 물건 옆의 다른 물건을 못 누르면 "방을 돌아다닌다"
   *    가 깨진다. 방을 좁히면 마커가 남는 영역 안으로 들어온다.
   *
   * ⚠️ 캔버스가 이 컴포넌트 밖(layout)에 있으므로 클래스가 아니라
   *    `<html>` 속성으로 알린다. 폭 값은 `tokens.css` 의 `--panel-w`.
   */
  const open = active && openId !== null
  useEffect(() => {
    if (!open) return
    document.documentElement.dataset.panelOpen = 'true'
    return () => {
      delete document.documentElement.dataset.panelOpen
    }
  }, [open])

  /*
   * ⚠️ 3D 를 못 쓰는 상황에서도 **모드는 선언한다.** `PageShell`·`ObjectStage`
   *    와 같은 규칙이다 — 캔버스가 라우트를 넘어 살아 있으므로 아무도
   *    말하지 않으면 이전 화면의 3D 가 남는다.
   *
   *    지금은 직전 화면의 cleanup 이 이미 'off' 로 돌려놔서 사고가 안 나지만,
   *    그건 **남의 cleanup 에 기대어 우연히 맞는** 상태다. 여기서 직접 말한다.
   */
  if (!active) return <CanvasMode mode="off" />

  return (
    <>
      <CanvasMode mode="room" />
      <r3f.In>
        <Suspense fallback={null}>
          <Scene openId={openId} seen={seen} onOpen={onOpen} onEntered={onEntered} />
        </Suspense>
      </r3f.In>
    </>
  )
}
