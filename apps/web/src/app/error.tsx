'use client'

import styles from '@/shared/ui/styles/form-page.module.css'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <Nav />
      <PageShell
        crumb="오류"
        title="일시적인 오류가 발생했습니다"
        lede="잠시 후 다시 시도해 주세요. 계속되면 프로젝트 문의 메일로 알려주세요."
      >
        <div className={styles.wrap}>
          <button type="button" className={styles.retry} onClick={reset}>
            다시 시도
          </button>
        </div>
      </PageShell>
    </>
  )
}
