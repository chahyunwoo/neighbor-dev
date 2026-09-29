import type { Metadata } from 'next'
import { getAllProjects, getStackFrequency } from '@/entities/project'
import { Reveal } from '@/features/reveal'
import { pageMetadata } from '@/shared/lib'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'
import styles from './page.module.css'

export const metadata: Metadata = pageMetadata({
  title: '기술 스택',
  description: '수행 프로젝트에서 사용한 기술과 사용 횟수입니다.',
  path: '/stack',
})

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
    <>
      <Nav />
      <PageShell
        from="bookshelf"
        wide
        crumb="책장"
        title="기술 스택"
        lede={`수행 프로젝트 ${total}건(자체 프로젝트 포함)에서 사용한 기술을 사용 횟수 기준으로 정리했습니다.`}
      >
        <div className={styles.groups}>
          <Group
            title="주력 기술"
            note={`3건 이상 사용 · ${repeated.length}종`}
            items={repeated}
            weight={3}
          />
          <Group title="사용 경험" note={`2건 사용 · ${twice.length}종`} items={twice} weight={2} />
        </div>
        <p className={styles.note}>
          2건 이상 사용한 기술만 표기합니다. 버전이 다른 표기는 하나로 합쳤고(예: NestJS 11,
          NestJS), 한 프로젝트 안의 중복은 한 번만 셉니다.
        </p>
      </PageShell>
    </>
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
      <Reveal className={styles.groupHead}>
        <h2 className={styles.groupTitle}>{title}</h2>
        <span className={styles.groupNote}>{note}</span>
      </Reveal>
      {/*
       * ⚠️ 태그 하나하나에는 연출을 걸지 않는다. 이 화면은 태그가 수십 개라
       *    stagger 가 끝없이 길어지고, `RevealItem` 은 `data-weight` 를 받지
       *    않아 굵기 스타일도 사라진다. **그룹 단위**로만 들어온다.
       */}
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
