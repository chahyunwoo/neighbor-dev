import type { Metadata } from 'next'
import { ContactForm } from '@/entities/contact'
import { apiFetch } from '@/shared/api'
import { COMPANY, pageMetadata } from '@/shared/lib'
import styles from '@/shared/ui/styles/form-page.module.css'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

export const metadata: Metadata = pageMetadata({
  title: '프로젝트 문의',
  description: '요구사항이 정리되지 않았어도 문의하실 수 있습니다. 범위 정의부터 함께 진행합니다.',
  path: '/contact',
})

// 매 요청마다 상태를 다시 본다 — 캡에 닿으면 화면이 바뀌어야 한다.
export const dynamic = 'force-dynamic'

async function fetchStatus(): Promise<{ available: boolean; dailyRemaining: number } | null> {
  try {
    const res = await apiFetch('/contact/status', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

// 폼이 안 떠도 무엇을 하는지는 서버 렌더로 읽힌다.
export default async function ContactPage() {
  const status = await fetchStatus()
  const usable = status?.available === true && (status?.dailyRemaining ?? 0) > 0

  return (
    <>
      <Nav />
      <PageShell
        from="door"
        crumb="현관문"
        title="프로젝트 문의"
        lede="요구사항이 정리되지 않았어도 문의하실 수 있습니다. 범위 정의부터 함께 진행합니다."
      >
        <div className={styles.wrap}>
          <p className={styles.prose}>진행 순서는 다음과 같습니다.</p>
          <ul className={styles.points}>
            <li className={styles.point}>
              <span className={styles.pointNo}>01</span>
              <span className={styles.pointText}>
                문의 확인 후 영업일 기준 1일 이내에 답변드립니다.
              </span>
            </li>
            <li className={styles.point}>
              <span className={styles.pointNo}>02</span>
              <span className={styles.pointText}>요구사항과 개발 범위를 함께 정리합니다.</span>
            </li>
            <li className={styles.point}>
              <span className={styles.pointNo}>03</span>
              <span className={styles.pointText}>
                확정된 범위를 기준으로 일정과 비용을 안내합니다.
              </span>
            </li>
          </ul>
          {usable ? (
            <ContactForm />
          ) : (
            <div className={styles.pending}>
              {status === null
                ? '지금은 문의 접수에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
                : status.available === false
                  ? '문의 접수를 준비하고 있습니다. 아래 메일로 연락해 주세요.'
                  : '오늘 접수 가능한 문의 수를 넘었습니다. 아래 메일로 연락해 주세요.'}
            </div>
          )}
          <p className={styles.direct}>
            메일 문의: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </p>
        </div>
      </PageShell>
    </>
  )
}
