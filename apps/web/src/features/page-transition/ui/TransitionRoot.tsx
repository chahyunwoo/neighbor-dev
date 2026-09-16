'use client'

import { useReducedMotion } from 'motion/react'
import { usePathname, useRouter } from 'next/navigation'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * 화면 전환 — **두 화면을 실제로 겹친다.**
 *
 * 🔴 **이전 구현은 "순차" 였고 그게 틀렸다.**
 *
 *    나가는 연출을 다 재생하고 → 라우트를 바꾸고 → 들어오는 연출을 재생했다.
 *    두 화면이 겹치는 순간이 **한 프레임도 없어서**, 아무리 곡선을 다듬어도
 *    "끊고 다시 시작" 으로 보인다. 사용자 지적: "빨리빨리 넘어가고 뚜둑뚜둑
 *    끊긴다". 프레임률은 60fps 로 멀쩡했으니(실측: 33ms 초과 0개) 성능이
 *    아니라 **구조가 문제**였다.
 *
 * 🔴 **View Transitions API 가 그 겹침을 해 준다.** 브라우저가 이전 화면을
 *    스냅샷으로 잡고 새 화면과 GPU 에서 합성한다 — 손으로 맞출 수 없는 일이다.
 *    실측 2026-09-16(Chrome 153): 콜백 9ms · 스냅샷 준비 19ms · 기본
 *    크로스페이드 300ms. 전환 한가운데를 찍으니 **두 화면의 글자가 겹쳐 보였다.**
 *
 *    ⚠️ 한 번 헛다리를 짚었다. `React.unstable_ViewTransition` 이 없고 Next 에
 *       `experimental.viewTransition` 플래그도 없어서 "못 쓴다" 고 결론냈는데,
 *       그건 **프레임워크 통합**이 없다는 뜻이었다. 네이티브 API 는 그대로 있다.
 *
 * 🔴 **3D 는 아무것도 안 한다.** 캔버스는 layout 에 있어 라우트가 바뀌어도
 *    교체되지 않고 VT 스냅샷 안에서 그대로 보인다. 전에는 `data-transition`
 *    으로 CSS 를 걸어 뒤로 물리다가 **목표에 닿기 전에 라우트가 바뀌어 튕겨
 *    돌아왔다**(실측: 449ms 에 scale 0.975 → 499ms 에 1). 그 코드는 걷어냈다.
 */

/** `document.startViewTransition` 이 있는 브라우저인가. */
function canViewTransition(): boolean {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function'
}

/**
 * 이 세션에서 라우트를 몇 번 갈아탔는가.
 *
 * 🔴 **0 이면 "처음 들어온 화면"** 이다. 그때만 글자 단위 등장 연출을 켠다 —
 *    라우트 전환에는 View Transitions 가 화면을 통째로 겹쳐 넘기므로, 그 위에
 *    글자 연출을 또 얹으면 **VT 가 새 화면을 찍는 58ms 시점에 제목이 투명해**
 *    겹칠 그림이 없어진다(실측 2026-09-16: 320ms·560ms 스크린샷이 비었다).
 *
 *    첫 로드에는 VT 가 없으니 충돌할 것도 없고, 첫인상에서 효과가 가장 크다.
 */
const NavCountCtx = createContext(0)

export function useNavCount(): number {
  return useContext(NavCountCtx)
}

export function TransitionRoot({ children }: { children: ReactNode }) {
  const [navCount, setNavCount] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
  const reduced = useReducedMotion()

  /**
   * 라우트 전환이 끝났음을 VT 에 알리는 손잡이.
   *
   * 🔴 `startViewTransition(cb)` 은 **cb 가 끝나야** 새 화면을 찍는다. 그런데
   *    `router.push` 는 비동기라 그 자리에서 DOM 이 안 바뀐다 — 그대로 두면
   *    브라우저가 **바뀌기 전 화면**을 새 화면으로 찍어 아무 일도 안 일어난다.
   *    cb 가 Promise 를 돌려주게 하고, 경로가 실제로 바뀐 뒤에 풀어 준다.
   */
  const settle = useRef<(() => void) | null>(null)

  // pathname 은 값을 읽으려고가 아니라 **경로가 실제로 바뀐 순간을 잡으려고** 넣었다.
  // 빼면 VT 가 새 화면을 못 찍고 기다리다 타임아웃까지 간다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 경로 변경을 잡는 트리거다
  useEffect(() => {
    /*
     * ⚠️ **여기서 `requestAnimationFrame` 을 기다리면 안 된다.** VT 콜백이
     *    끝날 때까지 브라우저가 렌더를 멈추므로 raf 가 영영 안 돌아 **데드락**이
     *    된다 — 실측 2026-09-16: 콜백이 타임아웃(1200ms)까지 갔다.
     *    `useEffect` 는 React 커밋 뒤라 DOM 은 이미 새 화면이다.
     */
    settle.current?.()
    settle.current = null
  }, [pathname])

  const go = useCallback(
    (href: string) => {
      // 움직임을 끈 사람 · 지원 안 하는 브라우저 — 그냥 이동한다.
      if (reduced || !canViewTransition()) {
        setNavCount((n) => n + 1)
        router.push(href)
        return
      }
      // 앞선 전환이 아직 안 끝났으면 그쪽을 먼저 풀어 준다(연타).
      settle.current?.()
      setNavCount((n) => n + 1)
      document.startViewTransition(() => {
        router.push(href)
        return new Promise<void>((resolve) => {
          settle.current = resolve
          // 경로 변경을 못 받는 경우에도 영원히 매달리지 않는다.
          setTimeout(() => {
            settle.current?.()
            settle.current = null
          }, 1200)
        })
      })
    },
    [reduced, router],
  )

  useEffect(() => {
    /*
     * ⚠️ **가로채면 안 되는 클릭이 있다.** 새 탭(⌘·Ctrl·Shift·Alt), 가운데·
     *    오른쪽 버튼, `target`, 다운로드, 외부 주소, 앵커(#), 지금 있는 경로.
     *
     * ⚠️ **가장 가까운 인터랙티브 요소가 링크일 때만.** `closest('a')` 만 보면
     *    링크 안에 든 버튼을 눌러도 바깥 링크를 찾는다 — `/work` 카드가
     *    `<Link>` 이고 그 안에 스택 펼침 버튼이 있어서, 그걸 누르면 **펼치기가
     *    죽었다**(`verify-fold` 가 `4100 → 4100` 으로 잡았다).
     */
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const el = e.target as Element | null
      const hit = el?.closest('a, button, [role="button"], input, select, textarea, summary, label')
      if (!(hit instanceof HTMLAnchorElement)) return
      if (hit.target && hit.target !== '_self') return
      if (hit.hasAttribute('download')) return
      if (hit.dataset.noTransition !== undefined) return

      const href = hit.getAttribute('href')
      if (!href?.startsWith('/')) return
      if (href === pathname) return

      /*
       * 🔴 `stopPropagation` 까지 한다. capture 단계라 `next/link` 의 핸들러보다
       *    먼저 도는데, 막지 않으면 Link 가 곧바로 이동시켜 VT 가 잡을 이전
       *    화면이 사라진다.
       */
      e.preventDefault()
      e.stopPropagation()
      go(href)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname, go])

  useEffect(() => {
    return () => {
      settle.current?.()
    }
  }, [])

  return <NavCountCtx.Provider value={navCount}>{children}</NavCountCtx.Provider>
}
