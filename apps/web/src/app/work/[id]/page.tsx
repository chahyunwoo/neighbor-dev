import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '../../../components/PageShell'
import { ProjectLens } from '../../../components/ProjectLens'
import { RichText } from '../../../components/RichText'
import { type DetailProject, getDetailProjects, getProject } from '../../../lib/projects'
import styles from './page.module.css'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * 🔴 사례 상세는 **`detail` 층만** 정적 생성한다.
 *    `summary` 층 id 로 들어오면 404 다 — 경력 요약 건에는 상세 화면이 없다.
 *    이것이 층 규칙의 마지막 방어선이다(빌드 → 타입 → 라우트).
 */
export function generateStaticParams() {
  return getDetailProjects().map((p) => ({ id: p.id }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const project = getProject(id)
  if (project?.tier !== 'detail') return { title: '없는 사례' }
  return {
    title: project.label,
    description: project.problem?.slice(0, 150) ?? project.label,
  }
}

export default async function ProjectPage({ params }: Params) {
  const { id } = await params
  const project = getProject(id)

  // 층 검사를 라우트에서 한 번 더 한다. 타입만 믿지 않는다 —
  // id 는 URL 에서 오는 외부 입력이다.
  if (project?.tier !== 'detail') notFound()

  return (
    <PageShell
      from="monitor"
      fig="[ fig. 2-1 · 모니터 · 사례 ]"
      crumb="모니터"
      title={project.label}
      lede={project.period}
    >
      <div className={styles.body}>
        <Problem project={project} />
        <Role project={project} />
        {/*
         * 기획서 4절의 토글. 두 축을 한 화면에 쌓지 않고 전환한다 —
         * 전환 자체가 인터랙션이고, 발주자와 개발자가 볼 것이 갈린다.
         */}
        <ProjectLens
          decisionCount={project.decisions?.length ?? 0}
          metricCount={project.metrics?.length ?? 0}
          decisions={<Decisions project={project} />}
          metrics={<Metrics project={project} />}
        />
        <Stack project={project} />
      </div>
    </PageShell>
  )
}

function Problem({ project }: { project: DetailProject }) {
  if (!project.problem) return null
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>무엇이 문제였나</h2>
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
        <h2 className={styles.blockTitle}>맡은 범위</h2>
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
      <p className={styles.blockNote}>선택한 것과 버린 것, 그리고 그 대가</p>
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
              <span className={styles.decisionKey}>이유</span>
              <span className={styles.decisionVal}>
                <RichText>{d.이유}</RichText>
              </span>
              <span className={styles.decisionKey}>대가</span>
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
      <p className={styles.blockNote}>전부 지금 다시 돌려볼 수 있는 것</p>
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
  if (project.stack.length === 0) return null
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>쓴 기술</h2>
      </div>
      <div className={styles.stack}>
        {project.stack.map((s) => (
          <span key={s} className={styles.tag}>
            {s}
          </span>
        ))}
      </div>
    </section>
  )
}
