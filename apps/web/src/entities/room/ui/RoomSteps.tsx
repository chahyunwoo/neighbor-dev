'use client'

import { ROOM_OBJECTS } from '@/entities/room/model/room'

// 3D 일 때의 동선 안내. 3D 가 없으면 RoomList 가 대신하고 둘은 같은 ROOM_OBJECTS 를 쓴다.
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
    // 폭을 카피 너비로 묶는다 — 부모 폭을 다 먹으면 보이지 않는 오른쪽이 3D 마커 클릭을 가로챈다.
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
