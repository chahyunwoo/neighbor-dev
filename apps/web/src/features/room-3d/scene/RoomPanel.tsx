'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ROOM_OBJECTS, type RoomObject } from '@/entities/room'

/**
 * 방의 물건을 열면 나오는 패널 (기획서 4절 · 시안 `#panel`).
 *
 * 🔴 **방을 떠나지 않는다.** 이전 구현은 마커를 `router.push` 로 연결해서
 *    누르는 순간 3D 가 사라지고 문서 페이지로 갔다 — 그러면 "작업실 안에
 *    프로젝트가 산다"(4절)가 성립하지 않고, 3D 는 첫 화면 장식으로 전락한다.
 *    패널은 3D 위에 얹히므로 방이 끝까지 살아 있다.
 *
 * ⚠️ 그래도 **각 페이지는 그대로 둔다.** 패널은 요약이고, "자세히 보기" 가
 *    실제 페이지로 간다 — URL·SEO·공유 링크가 살아야 하고(기획서 8절이
 *    Vercel 을 고른 이유가 SEO 다), JS 없이 오는 방문자에게는 그 페이지가
 *    유일한 경로다(4절 폴백 3단).
 *
 * 접근성: 열리면 포커스를 패널로 옮기고, Esc 로 닫고, 닫으면 원래 있던
 * 마커로 포커스를 되돌린다. 키보드만 쓰는 방문자가 3D 안에 갇히지 않게.
 */

export function RoomPanel({
  openId,
  onClose,
  onNavigate,
}: {
  /** 열린 물건의 id. `null` 이면 닫힌 상태. */
  openId: string | null
  onClose: () => void
  /** 다음 물건으로 — 순회가 동선이다(시안 TOUR). */
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
      {/*
       * 🔴 "뒤쪽을 눌러 닫기" 오버레이를 두지 않는다.
       *
       *    처음엔 `fixed inset-0` 버튼을 깔았는데 **화면 전체를 덮어 왼쪽
       *    번호 목록이 눌리지 않았다**(실측 2026-09-09: 그 지점의 최상위
       *    요소가 이 버튼이었다). 패널이 열린 채로 다른 물건에 못 가면
       *    "방을 돌아다닌다" 가 깨진다 — 그게 이 패널의 존재 이유다.
       *
       *    닫는 길은 세 개로 충분하다: ✕ 버튼 · Esc · 다른 물건 열기.
       *    3D 를 직접 눌러 닫고 싶다면 캔버스 쪽에 핸들러를 달아야 하고,
       *    그건 마커 클릭과 충돌하므로 지금은 두지 않는다.
       */}
      {/*
       * 🔴 위아래를 비운다. 처음엔 `inset-y-0 z-[8]` 로 뒀다가 **nav 와 footer 를
       *    통째로 덮었다**(실측 스크린샷 2026-09-09: "둘러보기·만든 것" 이
       *    패널 헤더와 겹쳐 둘 다 안 읽혔다).
       *    nav 는 z-5 이므로 패널은 그 아래(z-4)에 두고, 상단은 nav 높이만큼,
       *    하단은 footer 높이만큼 비운다 — 방을 떠나지 않는 패널이라
       *    사이트의 뼈대(nav·footer)는 계속 보여야 한다.
       */}
      <aside
        ref={ref}
        tabIndex={-1}
        aria-label={`${item.name} — ${item.opens}`}
        className="fixed top-[78px] right-0 bottom-[74px] z-4 flex w-[480px] max-w-full flex-col
                   border-l border-line bg-[rgba(12,11,15,0.975)] outline-none
                   motion-safe:animate-[panelIn_.44s_cubic-bezier(.4,.05,.2,1)]"
      >
        <div className="flex-1 overflow-y-auto px-8 pt-7 pb-4">
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
                <dd className="text-right font-mono text-small text-fg-faint">{v}</dd>
              </div>
            ))}
          </dl>

          {/*
           * 🔴 한 줄 소신. 화면은 차갑게 두고 **이 문장이 온기를 진다**(4-A 절).
           *    여기까지 차가운 표를 읽은 사람이 마지막에 사람 목소리를 듣는다.
           */}
          <p
            className="mt-6 border-l-2 border-amber-line bg-amber-wash px-4 py-3.5
                       text-small leading-[1.72] font-light text-[#c0aa9c]"
          >
            {item.note}
          </p>
        </div>

        {/* 하단 고정 — 스크롤해도 다음 동선이 늘 손에 닿는다(시안 .pbar). */}
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
