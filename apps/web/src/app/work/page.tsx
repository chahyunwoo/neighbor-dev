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
import { RichText } from '@/shared/ui'
import styles from '@/shared/ui/styles/list-page.module.css'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

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
    <>
      <Nav />
      <PageShell
        from="whiteboard"
        wide
        fig={`[ fig. 2 · 화이트보드 · ${detail.length + summary.length}건 ]`}
        crumb="화이트보드"
        title="그동안 만든 것"
        lede="클라이언트사명은 전부 익명으로 씁니다. 수치는 지금도 다시 돌려볼 수 있는 것만 실었습니다."
      >
        {/*
         * 🔴 **등장 연출을 실제로 건다.** `features/reveal` 이 만들어져 있었는데
         *    **어느 화면에도 붙어 있지 않았다**(실측 2026-09-16: `<Reveal` 사용
         *    0건, main 도 동일). 만들어만 두고 배선을 안 한 것이라 화면은 계속
         *    정지 상태였다 — `panelIn` 키프레임이 정의 없이 죽어 있던 것과
         *    같은 형태다.
         */}
        {/*
         * ⚠️ **섹션을 통째로 `Reveal` 로 감싸지 않는다.** 그러면 섹션이 화면에
         *    걸치는 순간 `show` 가 되고, 안의 카드가 **variants 상속으로 전부
         *    같이** 보여 버린다 — 화면 밖 카드까지 opacity 100 이었다(실측
         *    2026-09-16). 각 묶음이 **자기 뷰포트를 따로 봐야** 순서가 산다.
         */}
        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>사례</h2>
            <span className={styles.sectionNote}>
              {detail.length}건 · 문제와 그때 내린 판단까지
            </span>
          </Reveal>
          {/* 카드는 하나씩 차례로 들어온다(`RevealGroup` 의 stagger). */}
          <RevealGroup className={styles.cards}>
            {detail.map((p) => (
              <RevealItem key={p.id} as="article">
                <DetailCard project={p} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>경력</h2>
            <span className={styles.sectionNote}>{summary.length}건 · 도메인과 기술만</span>
          </Reveal>
          <RevealGroup className={styles.rows}>
            {summary.map((p) => (
              // 🔴 key 에 id(=저장소명)를 쓰지 않는다 — RSC 페이로드로 HTML 에 실린다.
              <RevealItem key={`${p.label}${p.period}`}>
                <SummaryRow project={p} />
              </RevealItem>
            ))}
          </RevealGroup>
          <p className={styles.note}>
            위 {summary.length}건은 계약상 화면과 세부 판단을 공개할 수 없습니다.
            <br />
            도메인과 쓴 기술까지만 적었습니다 — 없는 일을 지어내지 않기 위해 남겨둡니다.
          </p>
        </section>
      </PageShell>
    </>
  )
}

/**
 * 화면에 낼 도메인 몇 개를 고른다.
 *
 * 🔴 정본의 `domain[]` 은 **검색 키워드용**이라 같은 뜻이 여러 번 들어 있다 —
 *    `예약 / 예약시스템 / 부킹`, `정산 / 수수료정산 / 파트너정산`.
 *    앞에서 그냥 3개를 자르면 **"예약 · 예약시스템 · 부킹"** 이 된다.
 *    서로 포함관계인 것을 걸러 뜻이 겹치지 않게 고른다.
 *
 * ⚠️ 완벽하지 않다 — `예약`과 `부킹` 처럼 글자가 안 겹치는 유사어는 못 거른다.
 *    화면을 보고 거슬리면 **정본의 순서를 고치는 것**이 맞다(여기서 단어를
 *    지어내지 않는다 — CLAUDE.md).
 */
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
      {/*
       * 🔴 **분야가 맨 앞이다.** 이 사이트를 보는 사람은 대부분 비개발자
       *    발주자다 — `TypeScript · NestJS` 로 시작하면 아무것도 안 읽힌다.
       *    `판단 3 · 지표 7` 도 걷어냈다. 그 숫자는 개발자에게만 뜻이 있고,
       *    카드는 **훑는 자리**라 읽을 것이 적을수록 좋다.
       */}
      {domains.length ? <p className={styles.cardDomain}>{domains.join(' · ')}</p> : null}
      <h3 className={styles.cardTitle}>{project.label}</h3>
      {project.problem ? (
        <p className={styles.cardProblem}>
          <RichText>{project.problem}</RichText>
        </p>
      ) : null}
      <div className={styles.cardFoot}>
        <span className={styles.period}>{project.period}</span>
        {/*
         * 기술은 **바닥에 2개만.** 훑을 때 방해가 안 되되, 개발자가 보면
         * 바로 눈에 든다(실측: peek 3 이면 카드 10장에 태그만 27개가 깔렸다).
         */}
        <StackTags names={displayStack(project.stack)} peek={2} label={project.label} />
      </div>
    </Link>
  )
}

function SummaryRow({ project }: { project: SummaryProject }) {
  const domains = pickDomains(project.domain)
  return (
    <div className={styles.row}>
      {/* 기획서 3절: 이 층의 표기는 **도메인** + 기간 + 기술 스택이다. */}
      {domains.length ? <p className={styles.rowDomain}>{domains.join(' · ')}</p> : null}
      <span className={styles.rowLabel}>{project.label}</span>
      <span className={styles.rowPeriod}>{project.period}</span>
      <div className={styles.rowStack}>
        <StackTags names={displayStack(project.stack)} peek={3} label={project.label} />
      </div>
    </div>
  )
}
