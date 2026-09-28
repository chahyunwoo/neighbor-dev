import type { Metadata } from 'next'
import { getCounts } from '@/entities/project'
import { ROOM_OBJECTS } from '@/entities/room'
import { pageMetadata } from '@/shared/lib'
import { Nav } from '@/widgets/nav'
import { PageShell } from '@/widgets/page-shell'

export const metadata: Metadata = pageMetadata({
  title: '팀 소개',
  description:
    '2026년 1월 설립한 4인 개발팀입니다. PM, 프론트엔드, 백엔드, 디자인이 직접 개발합니다.',
  path: '/team',
})

/**
 * 테이블 — 같이 일하는 사람들.
 *
 * 🔴 **기획서 2절이 확정한 범위만 쓴다.** 그 절은 초안 방침("팀 구성 워딩을
 *    쓰지 않는다")을 뒤집은 자리이고, 뒤집은 이유와 지킬 것이 함께 적혀 있다:
 *
 *    - 정체성이 SI·웹에이전시로 확정되면서 "1인이 다 감당하나?" 가 오히려
 *      불안 요소가 됐다 → 팀이 있다는 사실이 수주에 유리하다
 *    - ⚠️ 원 방침의 취지는 유지한다 — 금지 대상은 팀 구성 자체가 아니라
 *      *"프론트만 가능 / 백엔드는 팀원이"* 식으로 **본인 역량을 축소해
 *      보이게 하는 서술**이었다. 그래서 **본인(PM)은 풀스택으로 표기**한다.
 *
 * 🔴 실명·사진·연락처·개인정보를 넣지 않는다. 인원과 역할까지만.
 */
export default function TeamPage() {
  const counts = getCounts()
  const team = ROOM_OBJECTS.find((o) => o.id === 'team')

  return (
    <>
      <Nav />
      <PageShell
        from="team"
        crumb="테이블"
        title="팀 소개"
        lede="2026년 1월 설립. PM, 프론트엔드, 백엔드, 디자인 4인이 직접 개발합니다."
      >
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="mb-4 font-sans text-micro tracking-[0.1em] text-amber">구성</h2>
            <dl className="border-t border-line">
              {(team?.rows ?? []).map(([role, detail]) => (
                <div
                  key={role}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1
                           border-b border-line py-4"
                >
                  <dt className="text-base font-normal text-fg-strong">{role}</dt>
                  <dd className="font-sans text-small text-fg-faint">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-micro tracking-[0.1em] text-amber">진행 방식</h2>
            <div className="flex flex-col gap-4 text-base leading-[1.85] font-light text-fg-muted">
              <p>
                PM이 기획과 설계를 맡고 개발에도 직접 참여합니다. 요구사항 정의부터 납품까지 한
                사람이 책임지고 관리합니다.
              </p>
              <p>
                프론트엔드나 백엔드 한쪽만 맡는 프로젝트도 진행합니다. 이때도 API 명세, 인증 방식,
                데이터 구조처럼 연동되는 부분을 먼저 검토하고 착수합니다.
              </p>
              <p>
                지금까지 {counts.detail + counts.summary}건을 납품했습니다. 이 중 {counts.detail}
                건은 설계 판단과 결과 지표까지{' '}
                <a href="/work" className="text-amber hover:text-amber-bright">
                  수행 사례
                </a>
                에 공개하고 있습니다.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-micro tracking-[0.1em] text-amber">
              진행하지 않는 프로젝트
            </h2>
            <div className="flex flex-col gap-4 text-base leading-[1.85] font-light text-fg-muted">
              <p>
                요구사항이 정리되지 않은 문의는 범위 정의부터 함께 진행합니다. 범위 합의 없이
                개발부터 시작하는 계약은 받지 않습니다.
              </p>
            </div>
          </section>
        </div>
      </PageShell>
    </>
  )
}
