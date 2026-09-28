import Link from 'next/link'
import { Logo } from './Logo'
import styles from './Nav.module.css'

/** 시안(Main·Mobile)의 상단 바. 서버 컴포넌트 — JS 없이도 읽히고 눌린다. */
export function Nav() {
  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        <Logo />
        <span>이웃집 개발자</span>
      </Link>
      <div className={styles.links}>
        <Link href="/work">수행 사례</Link>
        <Link href="/stack">기술 스택</Link>
        <Link href="/team">팀 소개</Link>
        <Link href="/contact" className={styles.cta}>
          프로젝트 문의
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </Link>
      </div>
    </nav>
  )
}
