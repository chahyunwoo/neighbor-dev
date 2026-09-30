import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '@/shared/ui/styles/form-page.module.css'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없음',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <>
      <Nav />
      <PageShell
        crumb="404"
        title="페이지를 찾을 수 없습니다"
        lede="주소가 바뀌었거나 삭제된 페이지입니다."
      >
        <div className={styles.wrap}>
          <ul className={styles.policyList}>
            <li>
              <Link href="/">홈</Link>
            </li>
            <li>
              <Link href="/work">수행 사례</Link>
            </li>
            <li>
              <Link href="/contact">프로젝트 문의</Link>
            </li>
          </ul>
        </div>
      </PageShell>
    </>
  )
}
