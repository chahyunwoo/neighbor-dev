import type { Metadata } from 'next'
import { displayStack, getSummaryProjects, StackTags } from '@/entities/project'
import { RevealGroup, RevealItem } from '@/features/reveal'
import { pageMetadata } from '@/shared/lib'
import styles from '@/shared/ui/styles/list-page.module.css'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

export const metadata: Metadata = pageMetadata({
  title: '비공개 프로젝트',
  description: '계약상 화면과 세부 설계를 공개할 수 없는 프로젝트입니다. 업종과 기술만 표기합니다.',
  path: '/career',
})

// getSummaryProjects() 만 부른다. 내용이 적은 이유를 화면에서 설명한다 — 없으면 다음 사람이 채우려 든다.
export default function CareerPage() {
  const summary = getSummaryProjects()

  return (
    <>
      <Nav />
      <PageShell
        from="drawer"
        wide
        crumb="서랍"
        title="비공개 프로젝트"
        lede="계약상 화면과 세부 설계를 공개할 수 없는 프로젝트입니다. 업종과 사용 기술만 표기합니다."
      >
        <RevealGroup className={styles.rows}>
          {summary.map((p) => (
            // key 에 id(=저장소명)를 쓰지 않는다 — RSC 페이로드로 HTML 에 실린다.
            <RevealItem key={`${p.label}${p.period}`} className={styles.row}>
              <span className={styles.rowLabel}>{p.label}</span>
              <span className={styles.rowPeriod}>{p.period}</span>
              <div className={styles.rowStack}>
                <StackTags names={displayStack(p.stack)} peek={3} label={p.label} />
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
        <p className={styles.note}>공개 범위 안에서 더 필요한 내용은 문의 시 직접 설명드립니다.</p>
      </PageShell>
    </>
  )
}
