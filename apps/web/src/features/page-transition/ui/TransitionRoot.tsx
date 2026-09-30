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

// 화면 전환은 View Transitions 로 두 화면을 실제로 겹친다. 3D 캔버스는 layout 에 있어 아무것도 안 한다.

function canViewTransition(): boolean {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function'
}

// 0 이면 처음 들어온 화면 — 그때만 글자 연출을 켠다. 라우트 전환에서 켜면 VT 가 찍을 제목이 투명해진다.
const NavCountCtx = createContext(0)

export function useNavCount(): number {
  return useContext(NavCountCtx)
}

export function TransitionRoot({ children }: { children: ReactNode }) {
  const [navCount, setNavCount] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
  const reduced = useReducedMotion()

  // router.push 는 비동기라 cb 가 Promise 를 돌려주고 경로가 실제로 바뀐 뒤 풀어야 새 화면이 찍힌다.
  const settle = useRef<(() => void) | null>(null)

  // pathname 은 경로가 실제로 바뀐 순간을 잡는 트리거다 — 빼면 VT 가 타임아웃까지 기다린다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 경로 변경을 잡는 트리거다
  useEffect(() => {
    // 여기서 requestAnimationFrame 을 기다리지 않는다 — VT 콜백 동안 렌더가 멈춰 데드락이 된다.
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
          // 타이머를 풀릴 때 지운다 — 남으면 연타 시 다음 전환의 resolve 를 당겨 쓴다. 남의 손잡이는 비우지 않는다.
          let timer: ReturnType<typeof setTimeout> | undefined
          const done = () => {
            if (timer !== undefined) clearTimeout(timer)
            if (settle.current === done) settle.current = null
            resolve()
          }
          settle.current = done
          // 경로 변경을 못 받는 경우에도 영원히 매달리지 않는다.
          timer = setTimeout(done, 1200)
        })
      })
    },
    [reduced, router],
  )

  useEffect(() => {
    // 새 탭·가운데 버튼·target·다운로드·외부·앵커·현재 경로는 가로채지 않는다. 가장 가까운 인터랙티브 요소가 링크일 때만.
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

      // capture 단계에서 Link 보다 먼저 막아야 VT 가 이전 화면을 잡는다.
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
