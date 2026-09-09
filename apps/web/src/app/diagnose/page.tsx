import type { Metadata } from 'next'
import { DiagnoseForm } from '@/entities/diagnose'
import styles from '@/shared/ui/styles/form-page.module.css'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

export const metadata: Metadata = {
  title: '미리 진단해보기',
  description:
    '요구사항을 적으면 기술 스택·대략 기간·리스크를 정리해드립니다. 금액은 말하지 않습니다.',
}

/**
 * 🔴 서버에서만 읽는다. `NEXT_PUBLIC_` 접두사를 쓰지 않는 것이 요점이다 —
 *    그 접두사를 붙이면 값이 브라우저 번들에 박혀 api 주소가 공개된다.
 *    방문자 요청은 `app/api/diagnose/route.ts` 프록시를 거친다.
 */
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3100'

/** 매 요청마다 api 상태를 다시 본다 — 캡에 닿으면 화면이 바뀌어야 한다. */
export const dynamic = 'force-dynamic'

async function fetchStatus(): Promise<{ available: boolean; dailyRemaining: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/diagnose/status`, { cache: 'no-store' })
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
        fig={usable ? '[ fig. 5 · 노트북 ]' : '[ fig. 5 · 노트북 · 준비 중 ]'}
        crumb="노트북"
        title="내 프로젝트 미리 진단해보기"
        lede="만들고 싶은 것을 적으면 어떤 기술이 필요한지, 대략 얼마나 걸릴지, 어디가 위험한지를 정리해드립니다."
      >
        <div className={styles.wrap}>
          <ul className={styles.points}>
            <li className={styles.point}>
              <span className={styles.pointNo}>합니다</span>
              <span className={styles.pointText}>
                필요한 기술 스택 정리 · 범위를 쪼개는 방법 · 어디가 오래 걸릴지 · 빠진 것 짚기
              </span>
            </li>
            <li className={styles.point}>
              <span className={styles.pointNo}>안 합니다</span>
              <span className={styles.pointText}>
                <strong>금액은 말하지 않습니다.</strong> 요구사항 몇 줄로 나온 숫자가 협상의
                기준선이 되면 서로 손해입니다 — 견적은 사람이 직접 봅니다.
              </span>
            </li>
            <li className={styles.point}>
              <span className={styles.pointNo}>안 합니다</span>
              <span className={styles.pointText}>
                입력하신 내용을 <strong>저장하지 않습니다.</strong> 결과는 화면에만 표시되고,
                필요하시면 복사해서 문의에 붙여넣으시면 됩니다.
              </span>
            </li>
          </ul>

          {usable ? (
            <DiagnoseForm />
          ) : (
            <div className={styles.pending}>
              {status === null
                ? '지금은 연결할 수 없습니다. 잠시 후 다시 열어주세요.'
                : status.available === false
                  ? '아직 열지 않았습니다. 입력을 받는 서버부터 준비하고 있습니다.'
                  : '오늘 준비한 진단 횟수를 다 썼습니다. 내일 다시 열립니다 — 급하시면 문의로 직접 말씀해 주세요.'}
            </div>
          )}
        </div>
      </PageShell>
    </>
  )
}
