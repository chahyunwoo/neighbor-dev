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
        <Link href="/">둘러보기</Link>
        <Link href="/work">만든 것</Link>
        <Link href="/career">같이 일하기</Link>
        <Link href="/contact" className={styles.cta}>
          문 두드리기
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
