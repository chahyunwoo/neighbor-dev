import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  type Brief,
  type DetailProject,
  displayStack,
  getDetailProjects,
  getProject,
  ProjectLens,
  StackTags,
} from '@/entities/project'
import { pageMetadata } from '@/shared/lib'
import { JsonLd, RichText } from '@/shared/ui'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'
import styles from './page.module.css'

interface Params {
  params: Promise<{ id: string }>
}

// detail 층만 정적 생성한다 — summary 층에는 상세 화면이 없다.
export function generateStaticParams() {
  return getDetailProjects().map((p) => ({ id: p.id }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const project = getProject(id)
  // 없는 사례는 색인시키지 않는다.
  if (project?.tier !== 'detail') {
    return { title: '사례를 찾을 수 없음', robots: { index: false, follow: false } }
  }
  return pageMetadata({
    title: project.label,
    // 설명은 문장 중간에서 자르지 않는다 — 공유 카드에 말이 끊긴 채로 뜬다.
    description: summarize(project.problem, project.label),
    path: `/work/${id}`,
  })
}

/** 첫 문장까지만. 없으면 길이로 자르되 단어 경계를 지킨다. */
function summarize(problem: string | undefined, fallback: string): string {
  const t = problem?.trim()
  if (!t) return fallback
  const stop = t.search(/[.!?。]\s|다\.\s/)
  const first = stop > 0 ? t.slice(0, stop + 2).trim() : t
  if (first.length <= 160) return first
  return `${first.slice(0, 157).replace(/\s+\S*$/, '')}…`
}

export default async function ProjectPage({ params }: Params) {
  const { id } = await params
  const project = getProject(id)

  // id 는 URL 에서 오는 외부 입력이라 층 검사를 라우트에서 한 번 더 한다.
  if (project?.tier !== 'detail') notFound()

  return (
    <>
      <Nav />
      {/* client(사명)를 넣지 않는다. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: project.label,
          about: project.domain,
          keywords: project.stack.join(', '),
          inLanguage: 'ko',
          creator: { '@type': 'Organization', name: '이웃집 개발자' },
        }}
      />
      <PageShell from="monitor" crumb="모니터" title={project.label} lede={project.period}>
        <div className={styles.body}>
          {project.brief ? (
            <>
              <BriefView brief={project.brief} />
              {/* 원문은 접어 둔다. 접혀도 DOM 에 남아 크롤러가 수치를 읽는다. */}
              <details className={styles.full}>
                <summary className={styles.fullToggle}>원문 자세히 보기</summary>
                <div className={styles.fullBody}>
                  <Original project={project} />
                </div>
              </details>
            </>
          ) : (
            <Original project={project} />
          )}
          <Stack project={project} />
        </div>
      </PageShell>
    </>
  )
}

const BRIEF_BLOCKS = [
  ['problem', '과제'],
  ['role', '담당 범위'],
  ['decisions', '설계 판단'],
  ['metrics', '결과 지표'],
] as const

function BriefView({ brief }: { brief: Brief }) {
  return (
    <section className={styles.brief}>
      <p className={styles.briefSummary}>{brief.summary}</p>
      {BRIEF_BLOCKS.map(([key, title]) => (
        <div key={key} className={styles.block}>
          <h2 className={styles.blockTitle}>{title}</h2>
          <ul className={styles.briefList}>
            {brief[key].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function Original({ project }: { project: DetailProject }) {
  return (
    <>
      <Problem project={project} />
      <Role project={project} />
      {/* 설계 판단과 결과 지표는 토글로 전환한다 — 발주자와 개발자가 볼 것이 갈린다. */}
      <ProjectLens
        decisionCount={project.decisions?.length ?? 0}
        metricCount={project.metrics?.length ?? 0}
        decisions={<Decisions project={project} />}
        metrics={<Metrics project={project} />}
      />
    </>
  )
}

function Problem({ project }: { project: DetailProject }) {
  if (!project.problem) return null
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>과제</h2>
      </div>
      <p className={styles.prose}>
        <RichText>{project.problem}</RichText>
      </p>
    </section>
  )
}

function Role({ project }: { project: DetailProject }) {
  if (!project.role) return null
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>담당 범위</h2>
        {project.scale ? <span className={styles.blockNote}>{project.scale}</span> : null}
      </div>
      <p className={styles.prose}>
        <RichText>{project.role}</RichText>
      </p>
    </section>
  )
}

function Decisions({ project }: { project: DetailProject }) {
  const decisions = project.decisions ?? []
  if (decisions.length === 0) return null
  return (
    <section className={styles.block}>
      {/* 제목은 토글 탭이 준다. 여기서 다시 붙이면 두 번 읽힌다. */}
      <p className={styles.blockNote}>선택안 · 대안 · 근거 · 비용</p>
      <div className={styles.list}>
        {decisions.map((d) => (
          <article key={d.선택} className={styles.decision}>
            <p className={styles.decisionChoice}>
              <RichText>{d.선택}</RichText>
            </p>
            <div className={styles.decisionGrid}>
              <span className={styles.decisionKey}>대안</span>
              <span className={styles.decisionVal}>
                <RichText>{d.대안}</RichText>
              </span>
              <span className={styles.decisionKey}>근거</span>
              <span className={styles.decisionVal}>
                <RichText>{d.이유}</RichText>
              </span>
              <span className={styles.decisionKey}>비용</span>
              <span className={styles.decisionVal}>
                <RichText>{d.트레이드오프}</RichText>
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Metrics({ project }: { project: DetailProject }) {
  const metrics = project.metrics ?? []
  if (metrics.length === 0) return null
  return (
    <section className={styles.block}>
      {/* 재현 명령이 붙지 않은 수치는 빌드 단계에서 이미 빠졌다. */}
      <p className={styles.blockNote}>모두 재현 명령과 함께 표기</p>
      <div className={styles.list}>
        {metrics.map((m) => (
          <div key={m.항목} className={styles.metric}>
            <div className={styles.metricTop}>
              <span className={styles.metricName}>{m.항목}</span>
              <span className={styles.metricValue}>
                <RichText>{m.값}</RichText>
              </span>
            </div>
            <pre className={styles.metricRepro}>{m.재현}</pre>
          </div>
        ))}
      </div>
    </section>
  )
}

function Stack({ project }: { project: DetailProject }) {
  const names = displayStack(project.stack)
  if (names.length === 0) return null
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>사용 기술</h2>
      </div>
      <div className={styles.stack}>
        <StackTags names={names} peek={6} label={project.label} />
      </div>
    </section>
  )
}
