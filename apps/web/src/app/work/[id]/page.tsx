import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
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
  // 🔴 없는 사례는 색인시키지 않는다. 남는 URL 이 검색 결과에 뜨면 방문자가 막힌다.
  if (project?.tier !== 'detail') {
    return { title: '없는 사례', robots: { index: false, follow: false } }
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

  // 층 검사를 라우트에서 한 번 더 한다. 타입만 믿지 않는다 —
  // id 는 URL 에서 오는 외부 입력이다.
  if (project?.tier !== 'detail') notFound()

  return (
    <>
      <Nav />
      {/*
       * 사례 구조화 데이터.
       *
       * 🔴 **`client`(사명)를 넣지 않는다.** 공개 데이터에 애초에 없지만
       *    (`build-data.mjs` 가 불리언만 뽑는다) 여기서 다시 확인해 둔다.
       *    도메인·기간·기술은 화면에 이미 나가 있는 것이라 추가 노출이 아니다.
       */}
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
    </>
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

/**
 * 쓴 기술 — 정본의 원시 표기가 아니라 기술명으로, 그리고 **접어서** 싣는다.
 * 근거는 `StackTags.tsx` 주석(이슈 #2). 여기는 이미 상세 화면이라
 * 카드보다는 넉넉히 보인다.
 */
function Stack({ project }: { project: DetailProject }) {
  const names = displayStack(project.stack)
  if (names.length === 0) return null
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>쓴 기술</h2>
      </div>
      <div className={styles.stack}>
        <StackTags names={names} peek={6} label={project.label} />
      </div>
    </section>
  )
}
