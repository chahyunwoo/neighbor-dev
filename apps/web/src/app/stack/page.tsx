import type { Metadata } from 'next'
import { PageShell } from '../../components/PageShell'
import { getAllProjects, getStackFrequency } from '../../lib/projects'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: '쓰는 기술',
  description: '실제 프로젝트에서 쓴 기술과 그 횟수. 목록이 아니라 빈도입니다.',
}

/**
 * 책장 — 쓰는 기술.
 *
 * 🔴 "할 줄 아는 것" 목록이 아니라 **실제로 쓴 횟수**다. 데이터에서 세므로
 *    지어낼 수 없다 — 프로젝트에 없는 기술은 여기 나타나지 않는다.
 */
export default function StackPage() {
  const freq = getStackFrequency()
  const total = getAllProjects().length

  // 3건 이상 / 2건 — 두 덩어리. 1건짜리는 데이터 계층에서 이미 빠졌다.
  const repeated = freq.filter((f) => f.count >= 3)
  const twice = freq.filter((f) => f.count === 2)

  return (
    <PageShell
      from="bookshelf"
      fig={`[ fig. 3 · 책장 · ${freq.length}종 ]`}
      crumb="책장"
      title="쓰는 기술"
      lede={`${total}건에서 실제로 쓴 것만 셌습니다. 할 줄 아는 것이 아니라 써본 것입니다.`}
    >
      <div className={styles.groups}>
        <Group
          title="반복해서 쓴 것"
          note={`3건 이상 · ${repeated.length}종`}
          items={repeated}
          weight={3}
        />
        <Group title="두 번 쓴 것" note={`${twice.length}종`} items={twice} weight={2} />
      </div>
      <p className={styles.note}>
        <strong>두 번 이상 쓴 것만</strong> 실었습니다. 한 번 써본 것까지 늘어놓으면 무엇을 실제로
        다루는지가 안 보입니다.
        <br />
        버전 표기는 합쳐서 셌고(NestJS 11 과 NestJS 는 한 종), 한 프로젝트 안의 중복은 한 번만
        셉니다.
      </p>
    </PageShell>
  )
}

function Group({
  title,
  note,
  items,
  weight,
}: {
  title: string
  note: string
  items: { name: string; count: number }[]
  weight: number
}) {
  if (items.length === 0) return null
  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        <h2 className={styles.groupTitle}>{title}</h2>
        <span className={styles.groupNote}>{note}</span>
      </div>
      <div className={styles.items}>
        {items.map((f) => (
          <span key={f.name} className={styles.item} data-weight={weight}>
            {f.name}
            <span className={styles.count}>{f.count}</span>
          </span>
        ))}
      </div>
    </section>
  )
}
