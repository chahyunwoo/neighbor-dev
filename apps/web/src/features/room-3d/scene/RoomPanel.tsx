'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ROOM_OBJECTS, type RoomObject } from '@/entities/room'

// 패널은 방 위에 얹힌다 — 마커로 페이지 이동하면 3D 가 사라진다. 상세는 "자세히 보기" 로 실제 페이지에 둔다(SEO·JS 없는 방문자).
// 열리면 포커스를 옮기고 Esc 로 닫는다 — 키보드 방문자가 3D 안에 갇히지 않게.

export function RoomPanel({
  openId,
  onClose,
  onNavigate,
}: {
  openId: string | null
  onClose: () => void
  onNavigate: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const item = openId ? ROOM_OBJECTS.find((o) => o.id === openId) : undefined

  useEffect(() => {
    if (!item) return
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  if (!item) return null

  const i = ROOM_OBJECTS.findIndex((o) => o.id === item.id)
  const next = ROOM_OBJECTS[(i + 1) % ROOM_OBJECTS.length] as RoomObject

  return (
    <>
      {/* 전체를 덮는 "뒤쪽 눌러 닫기" 오버레이를 두지 않는다 — 왼쪽 번호 목록이 안 눌린다. */}
      {/* nav(z-5) 아래 z-4 에 두고 위아래를 nav·footer 높이만큼 비운다 — 덮으면 사이트 뼈대가 가려진다. */}
      <aside
        ref={ref}
        tabIndex={-1}
        aria-label={`${item.name} — ${item.opens}`}
        className="fixed top-[78px] right-0 bottom-[var(--foot-h,70px)] z-4 flex w-[480px] max-w-full flex-col
                   border-l border-line bg-[rgba(12,11,15,0.975)] outline-none
                   motion-safe:animate-[panelIn_.44s_cubic-bezier(.4,.05,.2,1)]"
      >
        {/* key 로 물건마다 새로 만들어 페이드를 다시 돌린다. 슬라이드는 패널째 움직이는 것처럼 보여 쓰지 않는다. 스크롤 초기화는 의도다. */}
        <div
          key={item.id}
          className="flex-1 overflow-y-auto px-8 pt-7 pb-4
                     motion-safe:animate-[panelSwap_.34s_cubic-bezier(.22,.61,.36,1)]"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="font-mono text-micro tracking-[0.1em] text-amber">
              {String(i + 1).padStart(2, '0')} / {String(ROOM_OBJECTS.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="-mt-1 h-8 w-8 rounded-[3px] border border-line text-fg-dim
                         transition hover:border-amber hover:text-amber"
            >
              ✕
            </button>
          </div>

          <h2 className="mt-3 text-h2 font-medium tracking-[-0.025em] text-fg-strong">
            {item.name}
          </h2>
          <p className="mt-1 text-small text-amber-dim">{item.opens}</p>
          <p className="mt-4 text-base leading-[1.75] font-light text-fg-muted">{item.sub}</p>

          <dl className="mt-6">
            {item.rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-t border-line py-3.5">
                <dt className="text-base font-light text-fg-muted">{k}</dt>
                <dd className="text-right font-sans text-small text-fg-faint">{v}</dd>
              </div>
            ))}
          </dl>

          <p
            className="mt-6 border-l-2 border-amber-line bg-amber-wash px-4 py-3.5
                       text-small leading-[1.72] font-light text-[#c0aa9c]"
          >
            {item.note}
          </p>
        </div>

        {/* 하단 고정 — 스크롤해도 다음 동선이 늘 손에 닿는다. */}
        <div className="flex flex-none items-center gap-2.5 border-t border-line px-6 py-3.5">
          <Link
            href={item.href}
            className="flex-1 rounded-[3px] border border-line py-3 text-center text-small
                       text-fg-dim transition hover:border-amber-line hover:text-amber"
          >
            자세히 보기
          </Link>
          <button
            type="button"
            onClick={() => onNavigate(next.id)}
            className="flex-1 rounded-[3px] border border-amber-line py-3 text-small
                       text-amber transition hover:bg-amber-wash"
          >
            {next.name} 보기 →
          </button>
        </div>
      </aside>
    </>
  )
}
