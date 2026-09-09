'use client'

import { ROOM_OBJECTS } from '../lib/room'

/**
 * 왼쪽 번호 목록 — 시안(Main.dc.html `.steps`)의 동선 안내.
 *
 * 🔴 이전 구현에는 **이게 통째로 없었다.** 방에 마커만 떠 있어서 방문자가
 *    "몇 개를 봐야 하는지 · 지금 어디인지 · 뭘 봤는지" 를 알 수 없었다.
 *    시안은 이 목록으로 순회를 안내한다 — 그게 "번호 순서대로 눌러보세요" 를
 *    실제로 가능하게 만드는 장치다.
 *
 * ⚠️ 3D 가 없을 때(모바일·JS 없음)는 `RoomList` 가 대신한다. 둘은 같은
 *    `ROOM_OBJECTS` 를 쓴다 — 세 경로가 같은 데이터라는 4절 규칙 그대로.
 */
export function RoomSteps({
  openId,
  seen,
  onOpen,
}: {
  openId: string | null
  seen: ReadonlySet<string>
  onOpen: (id: string) => void
}) {
  return (
    /*
     * 🔴 폭을 카피 너비로 묶는다.
     *
     *    실측 2026-09-09: 이 목록이 **1328px 폭**(x=56~1384)으로 화면을
     *    가로질러, 글자가 없는 오른쪽 절반이 3D 방을 통째로 덮고 있었다.
     *    그래서 테이블 마커(x=1047)가 안 눌렸다 — 버튼이 `flex` 기본값대로
     *    부모 폭을 다 먹는데, 보이는 것은 왼쪽 텍스트뿐이라 눈으로는 안 보인다.
     *
     *    시안의 어둠막(`.scrim`)이 520px 이므로 그 안에 맞춘다 —
     *    보이는 모습은 그대로이고 마커만 살아난다.
     */
    <nav className="mt-2.5 flex w-fit max-w-[420px] flex-col" aria-label="작업실 둘러보기">
      {ROOM_OBJECTS.map((o) => {
        const now = o.id === openId
        const done = seen.has(o.id) && !now
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onOpen(o.id)}
            aria-current={now ? 'true' : undefined}
            data-now={now}
            data-done={done}
            className="group relative flex items-baseline gap-3.5 py-3 pr-1 pl-4 text-left
                       transition-opacity data-[done=true]:opacity-40
                       hover:data-[done=true]:opacity-80
                       before:absolute before:left-0 before:top-1/2 before:h-0 before:w-0.5
                       before:-translate-y-1/2 before:bg-fg-ghost before:transition-[height]
                       before:duration-300 hover:before:h-4
                       data-[now=true]:before:h-7 data-[now=true]:before:bg-amber"
          >
            <span
              className="min-w-[15px] flex-none font-mono text-micro tracking-[0.06em]
                         text-fg-ghost transition-colors group-data-[now=true]:text-amber"
            >
              {o.no}
            </span>
            <span
              className="text-base tracking-[-0.01em] text-[#aeb6c4] transition-colors
                         group-hover:text-[#e4e9f2] group-data-[now=true]:font-medium
                         group-data-[now=true]:text-fg-strong"
            >
              {o.name}
            </span>
            <span
              className="ml-auto translate-x-[-4px] text-small font-light text-fg-ghost opacity-0
                         transition duration-200 group-hover:translate-x-0 group-hover:opacity-100
                         group-data-[now=true]:translate-x-0 group-data-[now=true]:opacity-100"
            >
              {o.opens}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
