import type { Metadata } from 'next'
import { ContactForm } from '../../components/ContactForm'
import { PageShell } from '../../components/PageShell'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: '일 맡기기',
  description: '무엇을 만들지 정해지지 않아도 괜찮습니다. 범위를 같이 정리하는 것부터 합니다.',
}

/** api 상태는 서버에서 본다. 브라우저에는 api 주소를 내보내지 않는다. */
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3100'

/** 매 요청마다 상태를 다시 본다 — 캡에 닿으면 화면이 바뀌어야 한다. */
export const dynamic = 'force-dynamic'

async function fetchStatus(): Promise<{ available: boolean; dailyRemaining: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/contact/status`, { cache: 'no-store' })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

/**
 * 현관문 — 문의.
 *
 * 🔴 폼이 안 뜨는 상태에서도 **무엇을 어떻게 하는지는 서버 렌더로 읽힌다.**
 *    JS 가 없거나 접수가 닫혔을 때 빈 화면이 되지 않게.
 */
export default async function ContactPage() {
  const status = await fetchStatus()
  const usable = status?.available === true && (status?.dailyRemaining ?? 0) > 0

  return (
    <PageShell
      from="door"
      fig="[ fig. 6 · 현관문 ]"
      crumb="현관문"
      title="일 맡기기"
      lede="무엇을 만들지 아직 안 정해졌어도 괜찮습니다. 범위를 같이 정리하는 것부터 합니다."
    >
      <div className={styles.wrap}>
        <p className={styles.prose}>
          기획서가 없어도, 화면 몇 장만 있어도 시작할 수 있습니다. 먼저 무엇을 만들 것인지 같이
          정리하고, 그 다음에 일정과 비용을 이야기합니다.
        </p>
        <ul className={styles.points}>
          <li className={styles.point}>
            <span className={styles.pointNo}>01</span>
            <span className={styles.pointText}>
              화면도 서버도 한 팀에서 합니다. 중간에 넘기는 구간이 없습니다.
            </span>
          </li>
          <li className={styles.point}>
            <span className={styles.pointNo}>02</span>
            <span className={styles.pointText}>
              무엇을 왜 그렇게 만들었는지 남깁니다. 다음 사람이 이어받을 수 있게요.
            </span>
          </li>
          <li className={styles.point}>
            <span className={styles.pointNo}>03</span>
            <span className={styles.pointText}>못 하는 것은 못 한다고 먼저 말씀드립니다.</span>
          </li>
        </ul>
        {usable ? (
          <ContactForm />
        ) : (
          <div className={styles.pending}>
            {status === null
              ? '지금은 접수 창구에 연결할 수 없습니다. 잠시 후 다시 열어주세요.'
              : status.available === false
                ? '접수 창구를 준비하고 있습니다. 곧 열립니다.'
                : '오늘 받을 수 있는 문의를 다 받았습니다. 내일 다시 열립니다.'}
          </div>
        )}
      </div>
    </PageShell>
  )
}
