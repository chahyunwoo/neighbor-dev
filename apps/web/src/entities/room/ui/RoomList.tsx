import Link from 'next/link'
import { ROOM_OBJECTS } from '@/entities/room/model/room'
import styles from './RoomList.module.css'

/**
 * 방의 물건을 목록으로 편다.
 *
 * 🔴 이 컴포넌트는 서버에서 렌더된다 — JS 를 꺼도 내용이 읽히고 링크가 눌린다.
 *    기획서 4절의 폴백 3단 중 3단(서버 렌더 HTML)이 이것이다.
 */
export function RoomList() {
  return (
    <div className={styles.list}>
      {ROOM_OBJECTS.map((o) => (
        <Link key={o.id} href={o.href} className={styles.item} data-accent={o.accent}>
          <span className={styles.icon} aria-hidden="true">
            {o.no}
          </span>
          <span className={styles.text}>
            <span className={styles.name}>{o.name}</span>
            <span className={styles.opens}>{o.opens}</span>
          </span>
          <svg
            className={styles.chevron}
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      ))}
    </div>
  )
}
