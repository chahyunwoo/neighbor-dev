'use client'

import { useReducedMotion } from 'motion/react'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { EXIT, PHASE_ATTR, type Phase } from '@/features/page-transition/lib/transition'

/**
 * 화면 전환의 시계.
 *
 * 🔴 **Next App Router 에는 exit 애니메이션이 없다.** 라우트가 바뀌는 순간
 *    이전 화면은 즉시 언마운트된다 — 글자가 흩어지는 것을 보여줄 시간이 없다.
 *    그래서 링크 클릭을 가로채 **연출을 먼저 재생하고, 끝나면 이동한다.**
 *
 * 🔴 **링크를 감싸는 컴포넌트를 만들지 않고 document 에서 한 번에 가로챈다.**
 *
 *    처음엔 `TransitionLink` 로 `next/link` 를 감쌌는데 **FSD 단방향에 걸렸다** —
 *    링크가 있는 곳이 `entities/room`(RoomList)과 `features/room-3d`(RoomPanel)라,
 *    둘 다 이 슬라이스를 import 할 수 없다(entities→features 는 역방향이고,
 *    features→features 는 같은 레이어 간 의존이다). `verify-fsd.mjs` 가 잡는다.
 *
 *    여기서 잡으면 **아무도 이 슬라이스를 import 하지 않아도** 전 링크가
 *    연출을 탄다. 나중에 링크가 늘어도 손댈 곳이 없다.
 *
 * 🔴 **움직임을 끈 사람에게는 지연도 없앤다.** `MotionConfig reducedMotion="user"`
 *    는 위치 변화를 지울 뿐 **기다리는 시간은 그대로 둔다** — 연출은 안 보이는데
 *    400ms 만 느려진다. 그 사람에게는 즉시 이동하는 것이 맞다.
 *
 * ⚠️ `usePathname` 을 쓴다. `CanvasMode` 가 이것을 거부한 것과 모순처럼 보이지만
 *    다른 쓰임이다 — 거기서는 **경로 문자열로 3D 모드를 분기**해서 동적 라우트가
 *    늘면 매칭 표가 어긋나는 게 문제였다. 여기서는 "경로가 바뀌었다" 는 사실만
 *    쓰고 어떤 경로인지는 보지 않는다. 어긋날 표가 없다.
 */

const TransitionCtx = createContext<{ phase: Phase }>({ phase: 'idle' })

export function useTransition(): { phase: Phase } {
  return useContext(TransitionCtx)
}

export function TransitionRoot({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const router = useRouter()
  const pathname = usePathname()
  const reduced = useReducedMotion()

  /** 예약된 이동. 연타·언마운트 때 취소한다. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /*
   * 경로가 바뀌면 나가는 상태를 푼다.
   *
   * 🔴 여기서 풀지 않으면 **새 화면이 흩어진 채로 뜬다.** 이 컴포넌트는
   *    layout 에 있어 라우트를 넘어 살아남는다.
   */
  // pathname 은 값을 읽으려고가 아니라 **경로가 바뀐 순간을 잡으려고** 넣었다.
  // 빼면 이 effect 가 다시 돌지 않아 새 화면이 흩어진 채로 뜬다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 경로 변경을 잡는 트리거다
  useEffect(() => {
    setPhase('idle')
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [pathname])

  /*
   * 3D 가 읽는 자리. import 로 엮지 않는다(FSD 단방향).
   * `CanvasMode` 가 `data-canvas-mode` 로 쓰는 방식 그대로다.
   *
   * ⚠️ 언마운트 때 지운다 — 남아 있으면 다음에 3D 가 물러난 채로 시작한다.
   */
  useEffect(() => {
    document.documentElement.setAttribute(PHASE_ATTR, phase)
    return () => {
      document.documentElement.removeAttribute(PHASE_ATTR)
    }
  }, [phase])

  useEffect(() => {
    /*
     * ⚠️ **가로채면 안 되는 클릭이 있다.** 아래를 전부 흘려보낸다 —
     *    새 탭(⌘·Ctrl·Shift·Alt), 가운데·오른쪽 버튼, `target` 이 있는 것,
     *    다운로드, 외부 주소, 앵커(#), 지금 있는 경로.
     *    하나라도 빠지면 "새 탭으로 열기" 가 조용히 같은 탭에서 열린다.
     */
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const el = e.target as Element | null
      const a = el?.closest('a')
      if (!(a instanceof HTMLAnchorElement)) return
      if (a.target && a.target !== '_self') return
      if (a.hasAttribute('download')) return
      // 새 창을 여는 rel 이나 명시적 opt-out.
      if (a.dataset.noTransition !== undefined) return

      const href = a.getAttribute('href')
      if (!href?.startsWith('/')) return // 외부·mailto·# 는 그대로

      // 같은 경로면 연출만 돌고 아무 일도 안 일어난다 — 흩어진 채로 남는다.
      if (href === pathname) return

      // 이미 나가는 중이면 무시한다. 연타로 타이머가 겹치면 두 번 이동한다.
      if (timer.current) {
        e.preventDefault()
        return
      }

      // 움직임을 끈 사람 — 기다리게 하지 않는다. 브라우저·Next 에 그대로 맡긴다.
      if (reduced) return

      /*
       * 🔴 `stopPropagation` 까지 한다. capture 단계라 `next/link` 의 클릭
       *    핸들러보다 먼저 도는데, 막지 않으면 Link 가 **곧바로** 이동시켜
       *    연출이 재생되기도 전에 화면이 바뀐다.
       *
       *    프리페치는 그대로 유효하다 — Link 의 hover·뷰포트 프리페치는
       *    클릭과 무관하게 이미 돌았고, 그 400ms 가 그걸 쓰는 시간이다.
       */
      e.preventDefault()
      e.stopPropagation()

      setPhase('exiting')
      timer.current = setTimeout(() => {
        timer.current = null
        router.push(href)
      }, EXIT.commit)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname, reduced, router])

  // 페이지를 떠날 때 예약이 남지 않게 한다.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return <TransitionCtx.Provider value={{ phase }}>{children}</TransitionCtx.Provider>
}
