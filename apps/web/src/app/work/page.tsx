import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '../../components/PageShell'
import { RichText } from '../../components/RichText'
import {
  type DetailProject,
  getDetailProjects,
  getSummaryProjects,
  type SummaryProject,
} from '../../lib/projects'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: '만든 것',
  description: '사례 상세와 경력 요약. 클라이언트사명은 전부 익명, 수치는 재현 명령이 있는 것만.',
}

/**
 * 화이트보드 — 만든 것.
 *
 * 🔴 두 층을 **화면 형태부터 다르게** 만든다. 사례 상세는 카드(문제·판단·수치),
 *    경력 요약은 한 줄 행(도메인 + 기간 + 스택). 형태가 같으면 다음 사람이
 *    "여기에도 문제를 넣자" 고 생각하게 된다 — 지난 세션의 사고가 그 형태였다.
 *
 *    타입도 이를 강제한다: `SummaryProject` 에는 `problem` 이 아예 없다.
 */
export default function WorkPage() {
  const detail = getDetailProjects()
  const summary = getSummaryProjects()

  return (
    <PageShell
      from="whiteboard"
      fig={`[ fig. 2 · 화이트보드 · ${detail.length + summary.length}건 ]`}
      crumb="화이트보드"
      title="그동안 만든 것"
      lede="클라이언트사명은 전부 익명으로 씁니다. 수치는 지금도 다시 돌려볼 수 있는 것만 실었습니다."
    >
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>사례</h2>
          <span className={styles.sectionNote}>{detail.length}건 · 문제와 그때 내린 판단까지</span>
        </div>
        <div className={styles.cards}>
          {detail.map((p) => (
            <DetailCard key={p.id} project={p} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>경력</h2>
          <span className={styles.sectionNote}>{summary.length}건 · 도메인과 기술만</span>
        </div>
        <div className={styles.rows}>
          {summary.map((p) => (
            // 🔴 key 에 id(=저장소명)를 쓰지 않는다 — RSC 페이로드로 HTML 에 실린다.
            <SummaryRow key={`${p.label}${p.period}`} project={p} />
          ))}
        </div>
        <p className={styles.note}>
          위 {summary.length}건은 계약상 화면과 세부 판단을 공개할 수 없습니다.
          <br />
          도메인과 쓴 기술까지만 적었습니다 — 없는 일을 지어내지 않기 위해 남겨둡니다.
        </p>
      </section>
    </PageShell>
  )
}

function DetailCard({ project }: { project: DetailProject }) {
  const metricCount = project.metrics?.length ?? 0
  const decisionCount = project.decisions?.length ?? 0

  return (
    <Link href={`/work/${project.id}`} className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.period}>{project.period}</span>
      </div>
      <h3 className={styles.cardTitle}>{project.label}</h3>
      {project.problem ? (
        <p className={styles.cardProblem}>
          <RichText>{project.problem}</RichText>
        </p>
      ) : null}
      <div className={styles.tags}>
        {project.stack.slice(0, 5).map((s) => (
          <span key={s} className={styles.tag}>
            {s}
          </span>
        ))}
      </div>
      {decisionCount + metricCount > 0 ? (
        <div className={styles.counts}>
          {decisionCount > 0 ? <span>판단 {decisionCount}</span> : null}
          {metricCount > 0 ? <span>지표 {metricCount}</span> : null}
        </div>
      ) : null}
    </Link>
  )
}

function SummaryRow({ project }: { project: SummaryProject }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{project.label}</span>
      <span className={styles.rowPeriod}>{project.period}</span>
      <div className={styles.rowStack}>
        {project.stack.slice(0, 8).map((s) => (
          <span key={s} className={styles.tag}>
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
