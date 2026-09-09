'use client'

import { useCallback, useState } from 'react'
import styles from './Hero.module.css'
import { RoomList } from './RoomList'
import { RoomSteps } from './RoomSteps'
import { Room } from './room/Room'
import { RoomPanel } from './room/RoomPanel'

/**
 * 히어로 — 3D 와 목록의 전환 지점.
 *
 * 🔴 **목록은 항상 DOM 에 있다.** 3D 가 뜨면 시각적으로만 감춘다
 *    (`clip-path`, `display:none` 아님) — 3D 를 못 쓰는 보조기술 사용자가
 *    갈 곳을 잃지 않게. 크롤러와 JS 비활성 브라우저는 애초에 목록만 받는다.
 *
 * 🔴 판단은 Room 한 곳에서 한다. 여기서 미디어쿼리를 다시 읽지 않는다 —
 *    두 곳에서 판단하면 어긋난 상태(3D 도 목록도 없는 화면)가 생긴다.
 *
 * 🔴 **열린 물건 상태를 여기서 쥔다.** 왼쪽 번호 목록과 3D 마커와 패널이
 *    같은 상태를 봐야 한다 — Room 안에 두면 목록이 "지금 어디인지" 를 모른다.
 */
export function Hero({ children }: { children: React.ReactNode }) {
  const [is3D, setIs3D] = useState(false)
  const onActive = useCallback((active: boolean) => setIs3D(active), [])

  const [openId, setOpenId] = useState<string | null>(null)
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())

  const open = useCallback((id: string) => {
    setOpenId(id)
    setSeen((prev) => new Set(prev).add(id))
  }, [])
  const close = useCallback(() => setOpenId(null), [])

  return (
    <div className={styles.stage}>
      <Room onActive={onActive} openId={openId} seen={seen} onOpen={open} />

      {/*
       * 좌측 어둠막 — 시안 `.scrim`.
       * 🔴 이게 없으면 흰 글자가 밝은 3D 위에 그대로 얹혀 안 읽힌다
       *    (실측 2026-09-09: 시안과 대조해 발견). 3D 를 어둡게 만드는 게
       *    아니라 **글자 뒤만** 어둡게 해서 대비를 만든다.
       */}
      {is3D ? <div className={styles.scrim} aria-hidden="true" /> : null}

      <div className={styles.copyLayer}>
        {children}
        {/* 3D 일 때만 — 목록이 안 보이므로 이 번호 목록이 동선을 진다. */}
        {is3D ? <RoomSteps openId={openId} seen={seen} onOpen={open} /> : null}
      </div>

      <div className={styles.room} data-mode={is3D ? '3d' : 'list'}>
        <RoomList />
      </div>

      <RoomPanel openId={openId} onClose={close} onNavigate={open} />
    </div>
  )
}
