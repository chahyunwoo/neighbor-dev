import Link from 'next/link'
import type { ReactNode } from 'react'
import { TransitionBody, TransitionTitle } from '@/features/page-transition'
import { ContentWidth, RoomStage } from '@/features/room-3d'
import { LegalLine } from '@/shared/ui'
import styles from './PageShell.module.css'

interface Props {
  /** 빵부스러기의 마지막 칸 — 어느 물건을 열었는지. */
  crumb: string
  title: string
  lede?: string
  /** 이 화면이 어느 물건에서 왔는가(room id). 주면 그 물건의 3D 가 배경에 선다. */
  from?: string
  /** 목록·카드 그리드처럼 본문이 넓어야 하는 화면 — 3D 가 더 얇게 물러난다. */
  wide?: boolean
  children: ReactNode
}

// Nav 를 여기서 렌더하지 않는다 — widgets 끼리 import 하지 않고 조합은 라우트가 한다.
export function PageShell({ crumb, title, lede, from, wide, children }: Props) {
  return (
    <div className={styles.page}>
      {/* 본문 폭을 <html> 에 알린다 — 캔버스 폭과 같은 곳에서 갈리도록. */}
      <ContentWidth wide={wide} />
      {/* from 이 없어도 모드를 선언한다 — 아무도 말하지 않으면 이전 화면의 3D 가 남는다. */}
      <RoomStage mode={from ? 'page' : 'off'} objectId={from ?? null} />
      <main className={styles.main}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <TransitionBody className={styles.crumb}>
              <Link href="/">← 작업실로</Link>
              <span aria-hidden="true">/</span>
              <span>{crumb}</span>
            </TransitionBody>
            <TransitionTitle text={title} className={styles.title} />
            {lede ? (
              <TransitionBody>
                <p className={styles.lede}>{lede}</p>
              </TransitionBody>
            ) : null}
          </div>
        </div>
        <TransitionBody>{children}</TransitionBody>
      </main>
      <footer className={styles.foot}>
        <LegalLine />
      </footer>
    </div>
  )
}
