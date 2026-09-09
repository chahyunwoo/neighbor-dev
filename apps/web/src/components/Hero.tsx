'use client'

import { useCallback, useState } from 'react'
import styles from './Hero.module.css'
import { RoomList } from './RoomList'
import { Room } from './room/Room'

/**
 * 히어로 — 3D 와 목록의 전환 지점.
 *
 * 🔴 **목록은 항상 DOM 에 있다.** 3D 가 뜨면 시각적으로만 감춘다
 *    (`clip-path`, `display:none` 아님) — 3D 를 못 쓰는 보조기술 사용자가
 *    갈 곳을 잃지 않게. 크롤러와 JS 비활성 브라우저는 애초에 목록만 받는다.
 *
 * 🔴 판단은 Room 한 곳에서 한다. 여기서 미디어쿼리를 다시 읽지 않는다 —
 *    두 곳에서 판단하면 어긋난 상태(3D 도 목록도 없는 화면)가 생긴다.
 */
export function Hero({ children }: { children: React.ReactNode }) {
  const [is3D, setIs3D] = useState(false)
  const onActive = useCallback((active: boolean) => setIs3D(active), [])

  return (
    <div className={styles.stage}>
      <Room onActive={onActive} />
      <div className={styles.copyLayer}>{children}</div>
      <div className={styles.room} data-mode={is3D ? '3d' : 'list'}>
        <RoomList />
      </div>
    </div>
  )
}
