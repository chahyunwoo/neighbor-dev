'use client'

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

/**
 * 방의 상태 — **화면이 아니라 앱이 쥔다.**
 *
 * 🔴 **이것이 3D 지속 캔버스의 표준 배치다.** 캔버스도 씬도 루트에 하나씩
 *    두고, 각 화면은 "지금 무엇을 보고 있는가" 만 선언한다. 씬을 화면 안에
 *    두면 라우트가 바뀔 때마다 죽고 다시 산다.
 *
 *    실측 2026-09-16: 씬이 페이지 안에 있을 때 전환마다 **91ms 짜리 멈춤**이
 *    났다(3회 전부 재현). GLTF 21개를 다시 세팅하는 비용이다. 캔버스는 이미
 *    `layout` 에 있어 살아남는데 **씬만 라우트에 묶여 있었다.**
 *
 * 🔴 상태를 여기 두면 화면은 서버 컴포넌트로 남을 수 있다. 각 화면은
 *    `RoomStage` 한 줄만 두고, 그것이 이 상태를 바꾼다.
 */

export type RoomMode =
  /** 홈 — 돌아다니고 누를 수 있다. 입장 연출이 있다. */
  | 'room'
  /** 본문 화면의 배경 — 같은 방을 그 물건 앞에서 본다. 조작 없음. */
  | 'page'
  /** 3D 를 쓰지 않는 화면(좁은 화면·reduced-motion·문서형 페이지). */
  | 'off'

interface RoomState {
  mode: RoomMode
  /** 지금 열려 있는(또는 페이지가 가리키는) 물건. */
  openId: string | null
  /** 이미 열어본 것 — 마커가 흐려져 "남은 것" 이 눈에 띈다. */
  seen: ReadonlySet<string>
  /** 입장 연출이 끝났는가. 홈의 카피가 이 뒤에 올라온다. */
  entered: boolean
}

interface RoomApi extends RoomState {
  /** 화면이 자기 모드를 선언한다. `RoomStage` 가 부른다. */
  declare: (mode: RoomMode, openId: string | null) => void
  /** 마커·목록에서 물건을 연다(홈 전용). */
  open: (id: string) => void
  close: () => void
  markEntered: () => void
}

const Ctx = createContext<RoomApi | null>(null)

/**
 * 방 상태를 읽는다.
 *
 * ⚠️ Provider 밖에서 부르면 **조용히 기본값을 주지 않고 던진다.** 3D 가 안
 *    뜨는 것은 화면상 티가 잘 안 나서, 배선이 끊긴 채로 오래 갈 수 있다.
 */
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

  const value = useMemo(
    () => ({ mode, openId, seen, entered, declare, open, close, markEntered }),
    [mode, openId, seen, entered, declare, open, close, markEntered],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
