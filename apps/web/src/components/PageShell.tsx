import Link from 'next/link'
import type { ReactNode } from 'react'
import { OBJECT_MODEL } from '../lib/room'
import { CanvasMode } from './canvas/CanvasMode'
import { ContentWidth } from './canvas/ContentWidth'
import { Nav } from './Nav'
import styles from './PageShell.module.css'
import { ObjectStage } from './room/ObjectStage'

interface Props {
  /** 시안의 [ fig. N · … ] 캡션. 도면 규약을 화면 전체에 유지한다. */
  fig: string
  /** 빵부스러기의 마지막 칸 — 어느 물건을 열었는지. */
  crumb: string
  title: string
  lede?: string
  /**
   * 이 화면이 어느 물건에서 왔는가 (`lib/room.ts` 의 id).
   *
   * 🔴 주면 그 물건의 3D 가 배경에 선다 — 방에서 누른 물건이 화면으로
   *    이어진다(기획서 4절). 안 주면 3D 없이 문서만 나온다.
   */
  from?: string
  /**
   * 본문이 넓어야 하는 화면인가 (목록·카드 그리드).
   *
   * 🔴 3D 는 배경이므로 본문에 자리를 양보한다(이슈 #8). 다만 **양보하는
   *    폭이 화면마다 달라야 한다** — 산문 화면(`/team`)은 좁아도 읽히지만,
   *    카드 그리드(`/work`)는 같은 폭을 주면 **3열이 1열로 무너져** 페이지가
   *    3772px 로 늘어지고 오른쪽이 통째로 빈다(실측 2026-09-09, 스크린샷).
   *
   *    이 값을 주면 본문이 화면을 거의 다 쓰고, 3D 는 더 얇게 뒤로 물러난다.
   */
  wide?: boolean
  children: ReactNode
}

/** 물건을 열었을 때의 공통 껍데기. 시안 Interaction·Work 의 상단부다. */
export function PageShell({ fig, crumb, title, lede, from, wide, children }: Props) {
  const stage = from ? OBJECT_MODEL[from] : undefined

  return (
    <div className={styles.page}>
      {/* 본문 폭을 <html> 에 알린다 — 캔버스 폭과 같은 곳에서 갈리도록. */}
      <ContentWidth wide={wide} />
      {/*
       * 🔴 `from` 이 없어도 **모드를 선언한다**. 캔버스가 라우트를 넘어
       *    살아 있으므로, 아무도 말하지 않으면 이전 화면의 3D 가 남는다.
       */}
      {stage ? (
        <ObjectStage model={stage.model} rotationY={stage.rotationY} scale={stage.scale} />
      ) : (
        <CanvasMode mode="off" />
      )}
      <Nav />
      <main className={styles.main}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <div className={styles.crumb}>
              <Link href="/">← 작업실로</Link>
              <span aria-hidden="true">/</span>
              <span>{crumb}</span>
            </div>
            <h1 className={styles.title}>{title}</h1>
            {lede ? <p className={styles.lede}>{lede}</p> : null}
          </div>
          <p className={styles.fig}>{fig}</p>
        </div>
        {children}
      </main>
    </div>
  )
}
