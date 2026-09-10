'use client'

import { useCallback, useEffect, useState } from 'react'
import { RoomList, RoomSteps } from '@/entities/room'
import { Room, RoomPanel } from '@/features/room-3d'
import { useCanRender3D } from '@/shared/lib'
import styles from './Hero.module.css'

/**
 * 히어로 — 3D 와 목록의 전환 지점.
 *
 * 🔴 **목록은 항상 DOM 에 있다.** 3D 가 뜨면 시각적으로만 감춘다
 *    (`clip-path`, `display:none` 아님) — 3D 를 못 쓰는 보조기술 사용자가
 *    갈 곳을 잃지 않게. 크롤러와 JS 비활성 브라우저는 애초에 목록만 받는다.
 *
 * 🔴 판단은 `lib/can-3d.ts` **한 곳**에서 한다. 여기도 `CanvasRoot` 도 같은
 *    훅을 부른다 — 이전에는 `Room` 과 `ObjectStage` 가 각각 미디어쿼리를
 *    읽었고 판정 타입도 달라(`boolean|null` vs `boolean`) 어긋날 자리가 있었다.
 *
 * ⚠️ 이전에는 `Room` 이 `onActive` 콜백으로 알려줬다. 그 경로는 한 프레임
 *    늦어(effect → 부모 setState) 목록이 깜빡였고, 캔버스가 layout 으로
 *    올라가면서 콜백 체인이 끊어질 자리도 생겼다. 훅을 직접 부른다.
 *
 * 🔴 **열린 물건 상태를 여기서 쥔다.** 왼쪽 번호 목록과 3D 마커와 패널이
 *    같은 상태를 봐야 한다 — Room 안에 두면 목록이 "지금 어디인지" 를 모른다.
 */
/**
 * 카피를 늦어도 이 시각에는 띄운다(ms).
 *
 * ⚠️ **하이드레이션 지연이 여기에 더해진다.** 1400 으로 잡았더니 실제로는
 *    `lit` 이 **2.2초**에야 켜졌다(실측). 이 타이머는 클라이언트가 살아난
 *    뒤부터 가므로, 화면에 글이 뜨는 시각은 항상 이보다 늦다.
 *    짧게 잡고 나머지는 CSS 트랜지션(0.7초)이 부드럽게 잇는다.
 */
const COPY_DEADLINE_MS = 250

export function Hero({ children }: { children: React.ReactNode }) {
  // null(SSR·첫 페인트)이면 false — 서버 HTML 은 항상 목록을 내보낸다.
  const is3D = useCanRender3D() === true

  /**
   * 입장 연출이 끝났는가.
   *
   * 🔴 UI 를 **연출 뒤에** 올린다(시안 `body.lit`). 방으로 걸어 들어오는
   *    3초 동안 카피와 목록이 이미 떠 있으면 "들어왔다" 가 아니라
   *    "화면이 로딩됐다" 로 읽힌다 — 연출이 있으나 마나가 된다.
   */
  const [lit, setLit] = useState(false)
  const onEntered = useCallback(() => setLit(true), [])

  /*
   * 🔴 **카피를 3D 로딩에 묶어두지 않는다** (이슈 #10).
   *
   *    `onEntered` 는 GLTF 21개를 다 받고 입장 비행까지 끝나야 불린다 —
   *    실측 2026-09-09: **4.5초**. 그동안 카피도 번호 목록도 `opacity:0`
   *    이라 화면에 방만 덩그러니 떠 있었고, "뭘 하라는 건지 알 수 없다" 는
   *    지적을 받았다(마커는 2.6초에 이미 7개 다 떠 있었다).
   *
   *    연출을 기다리되 **무한정 기다리지는 않는다.** 이 시각이 지나면
   *    3D 가 아직이어도 글을 먼저 보여준다 — 방문자가 읽을 것이 없는 시간이
   *    없어야 한다. 3D 가 그 전에 준비되면 `onEntered` 가 먼저 켠다.
   */
  useEffect(() => {
    const t = setTimeout(() => setLit(true), COPY_DEADLINE_MS)
    return () => clearTimeout(t)
  }, [])

  /** 카피가 한 번이라도 보였는가 — 보였으면 다시 숨기지 않는다(위 주석). */
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!is3D || lit) setShown(true)
  }, [is3D, lit])

  const [openId, setOpenId] = useState<string | null>(null)
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())

  const open = useCallback((id: string) => {
    setOpenId(id)
    setSeen((prev) => new Set(prev).add(id))
  }, [])
  const close = useCallback(() => setOpenId(null), [])

  return (
    <div className={styles.stage}>
      <Room active={is3D} openId={openId} seen={seen} onOpen={open} onEntered={onEntered} />

      {/*
       * 좌측 어둠막 — 시안 `.scrim`.
       * 🔴 이게 없으면 흰 글자가 밝은 3D 위에 그대로 얹혀 안 읽힌다
       *    (실측 2026-09-09: 시안과 대조해 발견). 3D 를 어둡게 만드는 게
       *    아니라 **글자 뒤만** 어둡게 해서 대비를 만든다.
       */}
      {is3D ? <div className={styles.scrim} data-lit={lit} aria-hidden="true" /> : null}

      {/*
       * `data-lit` 가 false 인 동안 카피는 아래에서 올라올 준비만 하고 있다.
       * 3D 가 아닐 때(모바일·JS 없음)는 연출 자체가 없으므로 바로 보인다.
       */}
      {/*
       * 🔴 **한 번 보인 글을 다시 숨기지 않는다** (이슈 #10).
       *
       *    서버 HTML 은 `is3D=false` 라 `data-lit="true"` 로 나간다(크롤러가
       *    글을 받아야 하므로 그게 맞다). 그런데 하이드레이션 뒤 `is3D` 가
       *    true 로 바뀌면 이 값이 **false 로 뒤집혀 이미 읽히던 카피가
       *    사라졌다가** 연출이 끝나고 다시 나타났다 — 실측 2026-09-09:
       *    opacity 가 1 → 0(869ms) → 다시 1(5.6초). 화면에서는 글이
       *    깜빡였다 없어지는 것으로 보인다.
       *
       *    그래서 `lit` 은 **한 방향으로만** 간다. 3D 가 준비되기 전에 이미
       *    보이고 있었다면 그대로 둔다.
       */}
      <div className={styles.copyLayer} data-lit={!is3D || lit || shown}>
        {children}
        {/* 3D 일 때만 — 목록이 안 보이므로 이 번호 목록이 동선을 진다. */}
        {is3D ? <RoomSteps openId={openId} seen={seen} onOpen={open} /> : null}
      </div>

      {is3D ? (
        <p className={styles.hint} data-hidden={openId !== null}>
          드래그해서 둘러보기 · 눌러서 열기
        </p>
      ) : null}

      <div className={styles.room} data-mode={is3D ? '3d' : 'list'}>
        <RoomList />
      </div>

      <RoomPanel openId={openId} onClose={close} onNavigate={open} />
    </div>
  )
}
