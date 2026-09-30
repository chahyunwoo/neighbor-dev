'use client'

import { useEffect, useState } from 'react'
import { RoomList, RoomSteps } from '@/entities/room'
import { TransitionBody } from '@/features/page-transition'
import { RoomPanel, RoomStage, useRoom } from '@/features/room-3d'
import { useCanRender3D } from '@/shared/lib'
import styles from './Hero.module.css'

// 하이드레이션 뒤부터 도는 타이머라 실제로는 이보다 늦게 뜬다. 짧게 잡고 CSS 트랜지션이 잇는다.
const COPY_DEADLINE_MS = 250

// 목록은 항상 DOM 에 둔다 — 3D 가 뜨면 clip-path 로 시각적으로만 감춘다(보조기술·크롤러용).
export function Hero({ children }: { children: React.ReactNode }) {
  // null(SSR·첫 페인트)이면 false — 서버 HTML 은 항상 목록을 내보낸다.
  const is3D = useCanRender3D() === true

  // 씬이 라우트를 넘어 살아 있으므로 열린 물건·입장 상태도 RoomProvider 가 쥔다.
  const { openId, seen, entered, open, close } = useRoom()

  // UI 는 입장 연출 뒤에 올린다 — 먼저 떠 있으면 "들어왔다" 가 아니라 로딩으로 읽힌다.
  const [deadline, setDeadline] = useState(false)
  const lit = entered || deadline

  // 카피를 3D 로딩에 묶어두지 않는다 — 이 시각이 지나면 3D 가 아직이어도 글을 먼저 보인다.
  useEffect(() => {
    const t = setTimeout(() => setDeadline(true), COPY_DEADLINE_MS)
    return () => clearTimeout(t)
  }, [])

  // 한 번 보인 카피는 다시 숨기지 않는다.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!is3D || lit) setShown(true)
  }, [is3D, lit])

  return (
    <div className={styles.stage}>
      {/* 3D 는 모드만 선언한다 — 씬은 캔버스 안에서 라우트를 넘어 산다. */}
      <RoomStage mode="room" />

      {/* 글자 뒤만 어둡게 하는 어둠막. 카피와 같은 래치를 쓴다 — lit 은 한 방향으로만 간다. */}
      {is3D ? (
        <div className={styles.scrim} data-lit={!is3D || lit || shown} aria-hidden="true" />
      ) : null}

      {/* 하이드레이션 뒤 is3D 가 true 가 되어도 이미 보이던 카피를 다시 숨기지 않는다. */}
      <div className={styles.copyLayer} data-lit={!is3D || lit || shown}>
        {/* 떠날 때 왼쪽 글 전체가 같이 나간다. 들어오는 연출은 data-lit 과 View Transitions 가 한다. */}
        <TransitionBody>
          {children}
          {/* 3D 일 때만 — 목록이 안 보이므로 이 번호 목록이 동선을 진다. */}
          {is3D ? <RoomSteps openId={openId} seen={seen} onOpen={open} /> : null}
        </TransitionBody>
      </div>

      {/* 힌트는 TransitionBody 로 감싸지 않는다 — absolute 라 래퍼가 끼면 위치가 바뀐다. */}
      {is3D ? (
        <p className={styles.hint} data-hidden={openId !== null}>
          드래그로 시점 이동 · 클릭으로 열기
        </p>
      ) : null}

      <div className={styles.room} data-mode={is3D ? '3d' : 'list'}>
        <RoomList />
      </div>

      <RoomPanel openId={openId} onClose={close} onNavigate={open} />
    </div>
  )
}
