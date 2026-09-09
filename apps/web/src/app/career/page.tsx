import type { Metadata } from 'next'
import { PageShell } from '../../components/PageShell'
import { getSummaryProjects } from '../../lib/projects'
import styles from '../work/page.module.css'

export const metadata: Metadata = {
  title: '이름 못 밝히는 일들',
  description: '계약상 화면과 세부 판단을 공개할 수 없는 건들. 도메인과 기술까지만 적었습니다.',
}

/**
 * 서랍 — 경력 요약 층.
 *
 * 🔴 이 화면은 `getSummaryProjects()` 만 부른다. 상세 필드는 타입에 없으므로
 *    실수로 넣을 수 없다. "왜 여기는 내용이 적은가"를 화면에서 직접 설명한다 —
 *    설명이 없으면 다음 사람이 채우려 든다.
 */
export default function CareerPage() {
  const summary = getSummaryProjects()

  return (
    <PageShell
      from="drawer"
      fig={`[ fig. 4 · 서랍 · ${summary.length}건 ]`}
      crumb="서랍"
      title="이름 못 밝히는 일들"
      lede="계약상 화면도 세부 판단도 공개할 수 없는 건들입니다. 도메인과 쓴 기술까지만 적었습니다."
    >
      <div className={styles.rows}>
        {summary.map((p) => (
          // 🔴 key 에 id(=저장소명)를 쓰지 않는다 — RSC 페이로드로 HTML 에 실린다.
          <div key={`${p.label}${p.period}`} className={styles.row}>
            <span className={styles.rowLabel}>{p.label}</span>
            <span className={styles.rowPeriod}>{p.period}</span>
            <div className={styles.rowStack}>
              {p.stack.slice(0, 10).map((s) => (
                <span key={s} className={styles.tag}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        여기 적히지 않은 것이 실력의 공백은 아닙니다 — 공개 범위의 문제입니다.
        <br />
        구체적으로 궁금한 부분이 있으면 문의 때 직접 말씀드리겠습니다.
      </p>
    </PageShell>
  )
}
