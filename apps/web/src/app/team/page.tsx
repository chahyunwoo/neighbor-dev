import type { Metadata } from 'next'
import { PageShell } from '../../components/PageShell'
import { getCounts } from '../../lib/projects'
import { ROOM_OBJECTS } from '../../lib/room'

export const metadata: Metadata = {
  title: '같이 일하는 사람들',
  description: '2026년 1월 출범. 넷이서 기획부터 배포까지 함께 합니다.',
}

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
    <PageShell
      fig="[ fig. 6 · 테이블 · 4인 ]"
      crumb="테이블"
      title="같이 일하는 사람들"
      lede="2026년 1월에 출범했습니다. 넷이서 기획부터 배포까지 함께 합니다."
    >
      <div className="flex flex-col gap-10">
        <section>
          <h2 className="mb-4 font-mono text-micro tracking-[0.1em] text-amber">구성</h2>
          <dl className="border-t border-line">
            {(team?.rows ?? []).map(([role, detail]) => (
              <div
                key={role}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1
                           border-b border-line py-4"
              >
                <dt className="text-base font-normal text-fg-strong">{role}</dt>
                <dd className="font-mono text-small text-fg-faint">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="mb-4 font-mono text-micro tracking-[0.1em] text-amber">일하는 방식</h2>
          <div className="flex flex-col gap-4 text-base leading-[1.85] font-light text-fg-muted">
            <p>
              <strong className="font-medium text-fg-strong">PM 이 전 영역을 직접 봅니다.</strong>{' '}
              넘길 곳이 없어서가 아니라, 넘긴 뒤에도 책임이 남아서입니다. 기획·설계·프론트·백엔드를
              같은 사람이 쥐고 있으면 "그건 프론트 문제입니다" 같은 말이 나올 자리가 없습니다.
            </p>
            <p>
              화면만 받거나 서버만 받는 일도 합니다. 다만 그때도 반대편을 읽고 시작합니다 — 경계에서
              생기는 문제가 대부분이고, 그 경계는 한쪽만 봐서는 안 보입니다.
            </p>
            <p>
              지금까지 {counts.detail + counts.summary}건을 납품했습니다. 그중 {counts.detail}건은
              무엇을 어떻게 판단했는지까지 공개하고 있습니다 —{' '}
              <a href="/work" className="text-amber hover:text-amber-bright">
                그동안 만든 것
              </a>
              에서 보실 수 있습니다.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-mono text-micro tracking-[0.1em] text-amber">받지 않는 일</h2>
          <div className="flex flex-col gap-4 text-base leading-[1.85] font-light text-fg-muted">
            <p>
              무엇을 만들지 정해지지 않은 상태는 괜찮습니다 — 정리부터 같이 합니다. 다만{' '}
              <strong className="font-medium text-fg-strong">
                범위를 정하지 않고 시작하자는 제안
              </strong>
              은 받지 않습니다. 그렇게 시작한 일은 양쪽 다 손해로 끝납니다.
            </p>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
