'use client'

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

// 방 상태는 화면이 아니라 앱이 쥔다 — 씬을 라우트에 묶지 않고, 화면은 서버 컴포넌트로 남아 RoomStage 한 줄로 모드만 선언한다.

export type RoomMode =
  /** 홈 — 돌아다니고 누를 수 있다. 입장 연출이 있다. */
  | 'room'
  /** 본문 화면의 배경 — 같은 방을 그 물건 앞에서 본다. 조작 없음. */
  | 'page'
  /** 3D 를 쓰지 않는 화면(좁은 화면·reduced-motion·문서형 페이지). */
  | 'off'

interface RoomState {
  mode: RoomMode
  openId: string | null
  /** 이미 열어본 것 — 마커가 흐려진다. */
  seen: ReadonlySet<string>
  entered: boolean
  night: boolean
}

interface RoomApi extends RoomState {
  declare: (mode: RoomMode, openId: string | null) => void
  /** 홈 전용. */
  open: (id: string) => void
  close: () => void
  markEntered: () => void
  /** entered 를 되돌린다 — 없으면 재입장 비행 중에도 data-room-entered 가 true 라 프로브가 비행 중에 클릭한다. */
  resetEntered: () => void
  toggleLight: () => void
}

const Ctx = createContext<RoomApi | null>(null)

// Provider 밖이면 기본값 대신 던진다 — 3D 가 안 뜨는 것은 티가 안 나 배선 끊김이 오래 간다.
export function useRoom(): RoomApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRoom 은 <RoomProvider> 안에서만 쓴다')
  return v
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<RoomMode>('off')
  const [openId, setOpenId] = useState<string | null>(null)
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())
  const [entered, setEntered] = useState(false)
  const [night, setNight] = useState(true)

  const declare = useCallback((nextMode: RoomMode, nextOpen: string | null) => {
    setMode(nextMode)
    setOpenId(nextOpen)
  }, [])

  const open = useCallback((id: string) => {
    setOpenId(id)
    setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])

  const close = useCallback(() => setOpenId(null), [])
  const markEntered = useCallback(() => setEntered(true), [])
  const resetEntered = useCallback(() => setEntered(false), [])
  const toggleLight = useCallback(() => setNight((v) => !v), [])

  const value = useMemo(
    () => ({
      mode,
      openId,
      seen,
      entered,
      night,
      declare,
      open,
      close,
      markEntered,
      resetEntered,
      toggleLight,
    }),
    [
      mode,
      openId,
      seen,
      entered,
      night,
      declare,
      open,
      close,
      markEntered,
      resetEntered,
      toggleLight,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
