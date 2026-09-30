import type { Metadata } from 'next'
import Link from 'next/link'
import {
  type DetailProject,
  displayStack,
  getDetailProjects,
  getSummaryProjects,
  StackTags,
  type SummaryProject,
} from '@/entities/project'
import { Reveal, RevealGroup, RevealItem } from '@/features/reveal'
import { pageMetadata } from '@/shared/lib'
import { RichText } from '@/shared/ui'
import styles from '@/shared/ui/styles/list-page.module.css'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

export const metadata: Metadata = pageMetadata({
  title: '수행 사례',
  description:
    '2025년 4월 이후 수행한 프로젝트. 고객사명은 익명으로 표기하고, 수치는 재현 가능한 것만 싣습니다.',
  path: '/work',
})

// 두 층을 화면 형태부터 다르게 만든다 — 형태가 같으면 요약 층에 상세를 싣게 된다.
export default function WorkPage() {
  const detail = getDetailProjects()
  const summary = getSummaryProjects()
  // 화면 비중은 의뢰 여부로 가른다. 공개 수준(tier)은 그대로라 개인 건도 상세 링크를 유지한다.
  const commissioned = detail.filter((p) => p.commissioned)
  const own = detail.filter((p) => !p.commissioned)

  return (
    <>
      <Nav />
      <PageShell
        from="whiteboard"
        wide
        crumb="화이트보드"
        title="수행 사례"
        lede="고객사명은 모두 익명으로 표기합니다. 수치는 지금도 다시 측정할 수 있는 것만 실었습니다."
      >
        {/* 섹션을 통째로 Reveal 로 감싸지 않는다 — variants 상속으로 화면 밖 카드까지 같이 보인다. */}
        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>외주 프로젝트</h2>
            <span className={styles.sectionNote}>
              {commissioned.length}건 · 과제, 설계 판단, 결과
            </span>
          </Reveal>
          <RevealGroup className={styles.cards}>
            {commissioned.map((p) => (
              <RevealItem key={p.id} as="article">
                <DetailCard project={p} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>외주 프로젝트 · 요약 공개</h2>
            <span className={styles.sectionNote}>{summary.length}건 · 업종과 기간</span>
          </Reveal>
          <RevealGroup className={styles.rows}>
            {summary.map((p) => (
              // key 에 id(=저장소명)를 쓰지 않는다 — RSC 페이로드로 HTML 에 실린다.
              <RevealItem key={`${p.label}${p.period}`}>
                <SummaryRow project={p} />
              </RevealItem>
            ))}
          </RevealGroup>
          <p className={styles.note}>
            위 {summary.length}건은 계약상 화면과 세부 설계를 공개할 수 없어 업종과 기간만
            표기합니다.
          </p>
        </section>

        {/* 직접 만든 것은 목록으로 내린다 — 발주자가 먼저 볼 것이 아니다. */}
        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>자체 프로젝트</h2>
            <span className={styles.sectionNote}>{own.length}건 · 이 사이트 포함</span>
          </Reveal>
          <RevealGroup className={styles.rows}>
            {own.map((p) => (
              <RevealItem key={p.id}>
                <OwnRow project={p} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      </PageShell>
    </>
  )
}

// 정본 domain[] 은 검색 키워드라 뜻이 겹친다. 포함관계인 것을 거른다 — 단어를 지어내지 않는다.
function pickDomains(domain: readonly string[] | undefined, n = 3): string[] {
  const out: string[] = []
  for (const d of domain ?? []) {
    const t = d.trim()
    if (!t) continue
    if (out.some((o) => o.includes(t) || t.includes(o))) continue
    out.push(t)
    if (out.length >= n) break
  }
  return out
}

function DetailCard({ project }: { project: DetailProject }) {
  const domains = pickDomains(project.domain)

  return (
    <Link href={`/work/${project.id}`} className={styles.card}>
      {/* 비개발자 발주자가 읽도록 분야가 맨 앞이다. */}
      {domains.length ? <p className={styles.cardDomain}>{domains.join(' · ')}</p> : null}
      <h3 className={styles.cardTitle}>{project.label}</h3>
      {/* cardBody 만 쓴다 — problem 으로 폴백하지 않는다(독자가 다르다). */}
      {project.cardBody ? (
        <p className={styles.cardProblem}>
          <RichText>{project.cardBody}</RichText>
        </p>
      ) : null}
      <div className={styles.cardFoot}>
        <span className={styles.period}>{project.period}</span>
        {/* 기술은 바닥에 2개만 — 훑는 자리다. */}
        <StackTags names={displayStack(project.stack)} peek={2} label={project.label} />
      </div>
    </Link>
  )
}

// SummaryRow 와 형태는 같지만 detail 층이라 상세 링크가 있다.
function OwnRow({ project }: { project: DetailProject }) {
  const domains = pickDomains(project.domain)
  return (
    <Link href={`/work/${project.id}`} className={styles.rowLink}>
      {domains.length ? <p className={styles.rowDomain}>{domains.join(' · ')}</p> : null}
      <span className={styles.rowLabel}>{project.label}</span>
      <span className={styles.rowPeriod}>{project.period}</span>
      <div className={styles.rowStack}>
        <StackTags names={displayStack(project.stack)} peek={3} label={project.label} />
      </div>
    </Link>
  )
}

function SummaryRow({ project }: { project: SummaryProject }) {
  const domains = pickDomains(project.domain)
  return (
    <div className={styles.row}>
      {/* 이 층의 표기는 도메인 + 기간 + 기술 스택까지다. */}
      {domains.length ? <p className={styles.rowDomain}>{domains.join(' · ')}</p> : null}
      <span className={styles.rowLabel}>{project.label}</span>
      <span className={styles.rowPeriod}>{project.period}</span>
      <div className={styles.rowStack}>
        <StackTags names={displayStack(project.stack)} peek={3} label={project.label} />
      </div>
    </div>
  )
}
