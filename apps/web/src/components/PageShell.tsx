import Link from 'next/link'
import type { ReactNode } from 'react'
import { OBJECT_MODEL } from '../lib/room'
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
  children: ReactNode
}

/** 물건을 열었을 때의 공통 껍데기. 시안 Interaction·Work 의 상단부다. */
export function PageShell({ fig, crumb, title, lede, from, children }: Props) {
  const stage = from ? OBJECT_MODEL[from] : undefined

  return (
    <div className={styles.page}>
      {stage ? (
        <ObjectStage model={stage.model} rotationY={stage.rotationY} scale={stage.scale} />
      ) : null}
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
