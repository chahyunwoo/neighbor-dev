import Link from 'next/link'
import type { ReactNode } from 'react'
import { Nav } from './Nav'
import styles from './PageShell.module.css'

interface Props {
  /** 시안의 [ fig. N · … ] 캡션. 도면 규약을 화면 전체에 유지한다. */
  fig: string
  /** 빵부스러기의 마지막 칸 — 어느 물건을 열었는지. */
  crumb: string
  title: string
  lede?: string
  children: ReactNode
}

/** 물건을 열었을 때의 공통 껍데기. 시안 Interaction·Work 의 상단부다. */
export function PageShell({ fig, crumb, title, lede, children }: Props) {
  return (
    <div className={styles.page}>
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
