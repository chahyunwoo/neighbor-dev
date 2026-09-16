'use client'

import { useEffect } from 'react'
import { type RoomMode, useRoom } from '@/features/room-3d/model/room-state'
import { useCanRender3D } from '@/shared/lib'

/**
 * 이 화면이 방을 어떻게 쓰는지 **선언만 한다.** 3D 를 그리지는 않는다.
 *
 * 🔴 씬은 캔버스 안에 고정되어 있다(`CanvasShell`). 화면은 "지금 무엇을
 *    보는가" 만 말하고, 그리는 일은 루트가 계속 맡는다 — 라우트가 바뀌어도
 *    씬이 죽지 않는다.
 *
 * 🔴 **`data-canvas-mode` 도 여기서 쓴다.** 캔버스의 자리·투명도·마스크는
 *    CSS 가 그 속성으로 정한다(`tokens.css`). 캔버스가 이 컴포넌트 밖에 있어
 *    클래스로는 못 바꾼다.
 *
 * ⚠️ 3D 가부 판단은 `lib/can-3d.ts` 한 곳에서 한다. 못 쓰는 상황이면
 *    `off` 로 선언한다 — **아무 말도 안 하면 이전 화면의 3D 가 그대로 남는다.**
 */
export function RoomStage({
  mode,
  objectId = null,
}: {
  /** `room`(홈) · `page`(본문 배경) · `off`(3D 없음) */
  mode: RoomMode
  /** `page` 일 때 카메라가 바라볼 물건. */
  objectId?: string | null
}) {
  const { declare, openId, entered } = useRoom()
  const can = useCanRender3D() === true
  const effective: RoomMode = can ? mode : 'off'

  useEffect(() => {
    declare(effective, effective === 'off' ? null : objectId)
  }, [declare, effective, objectId])

  /*
   * 패널이 열리면 캔버스를 왼쪽으로 좁힌다.
   *
   * 🔴 실측 2026-09-09: 패널을 그냥 얹었더니 **마커 2개(서랍·현관문)가 패널
   *    뒤로 숨었다.** 열린 물건 옆의 다른 물건을 못 누르면 "방을 돌아다닌다"
   *    가 깨진다. 방을 좁히면 마커가 남는 영역 안으로 들어온다.
   *
   * ⚠️ 캔버스가 이 컴포넌트 밖(layout)에 있으므로 클래스가 아니라 `<html>`
   *    속성으로 알린다. 폭 값은 `tokens.css` 의 `--panel-w`.
   *
   * ⚠️ 홈에서만이다. 페이지에는 패널이 없다.
   */
  const panelOpen = effective === 'room' && openId !== null
  useEffect(() => {
    if (!panelOpen) return
    document.documentElement.dataset.panelOpen = 'true'
    return () => {
      delete document.documentElement.dataset.panelOpen
    }
  }, [panelOpen])

  /*
   * 🔴 **입장 연출이 끝났음을 DOM 에 남긴다.**
   *
   *    브라우저 프로브가 "이제 마커를 눌러도 된다" 를 알 방법이 이것뿐이다.
   *    전에는 고정 대기(5000ms)로 버텼는데, 입장 시간을 4200ms 로 늘리자
   *    GLTF 로딩이 조금만 느려도 **첫 클릭이 비행 중에 일어나** 마커가
   *    빗나갔다 — `verify-clamp` 가 4회 중 2회 실패했고 실패 해상도도
   *    매번 달랐다(실측 2026-09-16).
   *
   *    시간으로 기다리지 말고 **상태로 기다린다.**
   */
  useEffect(() => {
    if (effective === 'off' || !entered) return
    document.documentElement.dataset.roomEntered = 'true'
    return () => {
      delete document.documentElement.dataset.roomEntered
    }
  }, [effective, entered])

  useEffect(() => {
    document.documentElement.dataset.canvasMode = effective === 'page' ? 'object' : effective
    return () => {
      /*
       * ⚠️ cleanup 에서 'off' 로 되돌린다 — 다음 화면이 선언하기 전 한 프레임
       *    동안 이전 3D 가 비치는 것을 막는다.
       */
      document.documentElement.dataset.canvasMode = 'off'
    }
  }, [effective])

  return null
}
