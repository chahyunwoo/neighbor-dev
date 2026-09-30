import Link from 'next/link'
import { COMPANY } from '@/shared/lib'
import styles from './LegalLine.module.css'

/** 사업자 정보·연락처·처리방침 링크. 홈 푸터와 모든 하위 화면이 같이 쓴다. */
export function LegalLine({ className }: { className?: string | undefined }) {
  return (
    <div className={className ? `${styles.legal} ${className}` : styles.legal}>
      <p>
        {COMPANY.name} · 대표 {COMPANY.owner} · 사업자등록번호 {COMPANY.bizNo}
      </p>
      <p>
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> ·{' '}
        <Link href="/privacy">개인정보처리방침</Link> · © {new Date().getFullYear()} 이웃집 개발자
      </p>
    </div>
  )
}
