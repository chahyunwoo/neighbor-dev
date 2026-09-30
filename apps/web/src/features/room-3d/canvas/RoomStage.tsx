'use client'

import { useEffect } from 'react'
import { type RoomMode, useRoom } from '@/features/room-3d/model/room-state'
import { useCanRender3D } from '@/shared/lib'

// 화면이 방을 어떻게 쓰는지 선언만 하고 data-canvas-mode 를 쓴다. 3D 불가면 off 를 선언해야 한다 — 말이 없으면 이전 화면의 3D 가 남는다.
export function RoomStage({
  mode,
  objectId = null,
}: {
  mode: RoomMode
  /** page 모드에서 카메라가 바라볼 물건. */
  objectId?: string | null
}) {
  const { declare, openId, entered } = useRoom()
  const can = useCanRender3D() === true
  const effective: RoomMode = can ? mode : 'off'

  useEffect(() => {
    declare(effective, effective === 'off' ? null : objectId)
  }, [declare, effective, objectId])

  /* 패널이 열렸음을 알린다 — 마커 클램프 경계를 패널 앞으로 당긴다(홈 전용). 캔버스를 좁히면 전환 중 프레임이 튄다. */
  const panelOpen = effective === 'room' && openId !== null
  useEffect(() => {
    if (!panelOpen) return
    document.documentElement.dataset.panelOpen = 'true'
    return () => {
      delete document.documentElement.dataset.panelOpen
    }
  }, [panelOpen])

  /* 입장 연출 종료를 DOM 에 남긴다 — 브라우저 프로브가 고정 대기 대신 이 상태로 기다린다. */
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
      // 다음 화면이 선언하기 전 한 프레임 동안 이전 3D 가 비치지 않게 off 로 되돌린다.
      document.documentElement.dataset.canvasMode = 'off'
    }
  }, [effective])

  return null
}
