import type { Metadata } from 'next'
import { DiagnoseForm } from '@/entities/diagnose'
import { apiFetch } from '@/shared/api'
import { pageMetadata } from '@/shared/lib'
import styles from '@/shared/ui/styles/form-page.module.css'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

export const metadata: Metadata = pageMetadata({
  title: '프로젝트 사전 진단',
  description:
    '요구사항을 입력하면 권장 기술 스택, 예상 기간, 주요 리스크를 정리해 드립니다. 견적 금액은 포함하지 않습니다.',
  path: '/diagnose',
})

/**
 * 🔴 서버에서만 읽는다. `NEXT_PUBLIC_` 접두사를 쓰지 않는 것이 요점이다 —
 *    그 접두사를 붙이면 값이 브라우저 번들에 박혀 api 주소가 공개된다.
 *    방문자 요청은 `app/api/diagnose/route.ts` 프록시를 거친다.
 */
/** 매 요청마다 api 상태를 다시 본다 — 캡에 닿으면 화면이 바뀌어야 한다. */
export const dynamic = 'force-dynamic'

async function fetchStatus(): Promise<{ available: boolean; dailyRemaining: number } | null> {
  try {
    const res = await apiFetch('/diagnose/status', { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // api 가 안 떠 있어도 페이지는 뜬다 — 그 사실을 화면에 적는다.
    return null
  }
}

/**
 * 노트북 — 상담 전 자가진단 (기획서 5절).
 *
 * 🔴 "하지 않을 것" 을 먼저 적는다. 금액을 말하지 않는 것과 저장하지 않는 것이
 *    이 기능의 요지다 — 방문자가 안심하고 적을 수 있어야 쓸모가 생긴다.
 *
 * ⚠️ 이 설명은 서버 렌더라 JS 를 꺼도 읽힌다. 입력 폼만 클라이언트다.
 */
export default async function DiagnosePage() {
  const status = await fetchStatus()
  const usable = status?.available === true && (status?.dailyRemaining ?? 0) > 0

  return (
    <>
      <Nav />
      <PageShell
        from="laptop"
        wide
        crumb="노트북"
        title="프로젝트 사전 진단"
        lede="요구사항을 입력하면 권장 기술 스택, 예상 기간, 주요 리스크를 정리해 드립니다."
      >
        <div className={styles.wrapWide}>
          <ul className={styles.points}>
            <li className={styles.point}>
              <span className={styles.pointNo}>01</span>
              <span className={styles.pointText}>
                권장 기술 스택, 개발 범위 분할, 일정 지연 요인, 누락된 요구사항을 정리합니다.
              </span>
            </li>
            <li className={styles.point}>
              <span className={styles.pointNo}>02</span>
              <span className={styles.pointText}>
                견적 금액은 제시하지 않습니다. 비용은 범위 확정 후 담당자가 직접 산정합니다.
              </span>
            </li>
            <li className={styles.point}>
              <span className={styles.pointNo}>03</span>
              <span className={styles.pointText}>
                입력 내용은 저장하지 않습니다. 결과는 화면에만 표시되며, 복사해 문의에 첨부할 수
                있습니다.
              </span>
            </li>
          </ul>

          {usable ? (
            <DiagnoseForm />
          ) : (
            <div className={styles.pending}>
              {status === null
                ? '지금은 진단 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
                : status.available === false
                  ? '진단 기능을 준비하고 있습니다. 프로젝트 문의로 연락해 주세요.'
                  : '오늘 진단 가능 횟수를 모두 사용했습니다. 급하신 경우 프로젝트 문의로 연락해 주세요.'}
            </div>
          )}
        </div>
      </PageShell>
    </>
  )
}
