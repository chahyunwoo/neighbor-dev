'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './Turnstile.module.css'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** 사이트 키가 없으면(로컬) 위젯 없이 제출을 막지 않는다. api 도 시크릿이 없으면 검증하지 않는다. */
export const turnstileEnabled = Boolean(SITE_KEY)

let loading: Promise<TurnstileApi> | null = null
function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    const fail = () => {
      // 다음 시도가 실패한 약속을 다시 받지 않게 비운다
      loading = null
      reject(new Error('turnstile'))
    }
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : fail())
    s.onerror = fail
    document.head.appendChild(s)
  })
  return loading
}

/** 사람 확인. 토큰은 한 번 쓰면 끝이라 제출할 때마다 resetKey 를 올려 새로 받는다. */
export function Turnstile({
  onToken,
  resetKey,
  className,
}: {
  onToken: (token: string | null) => void
  resetKey: number
  className?: string | undefined
}) {
  const el = useRef<HTMLDivElement>(null)
  const id = useRef<string | null>(null)
  const report = useRef(onToken)
  // 스크립트를 못 받으면 빈 상자만 남고 버튼이 잠긴 채로 끝난다 — 이유와 다시 시도를 보여준다
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Cloudflare 는 방문자를 사람으로 확신하면 아무 UI 도 그리지 않고 통과시킨다(iutzip.dev 실측).
  // 그동안 제출 버튼은 잠겨 있으므로 확인 상태만큼은 우리가 직접 보여준다.
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    report.current = onToken
  }, [onToken])

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt 은 값이 아니라 다시 불러오기 트리거다
  useEffect(() => {
    if (!SITE_KEY || !el.current) return
    let cancelled = false
    setFailed(false)
    setVerified(false)
    load()
      .then((ts) => {
        if (cancelled || !el.current) return
        id.current = ts.render(el.current, {
          sitekey: SITE_KEY,
          theme: 'dark',
          // 늘 보인다 — 통과 전에는 제출 버튼이 잠기므로, 안 보이면 방문자가 이유를 알 수 없다
          appearance: 'always',
          callback: (token: string) => {
            setVerified(true)
            report.current(token)
          },
          'expired-callback': () => {
            setVerified(false)
            report.current(null)
          },
          'error-callback': () => {
            setVerified(false)
            report.current(null)
          },
        })
      })
      .catch(() => {
        if (cancelled) return
        report.current(null)
        setFailed(true)
      })
    return () => {
      cancelled = true
      if (id.current) window.turnstile?.remove(id.current)
      id.current = null
    }
  }, [attempt])

  useEffect(() => {
    if (resetKey === 0 || !id.current) return
    setVerified(false)
    report.current(null)
    window.turnstile?.reset(id.current)
  }, [resetKey])

  if (!SITE_KEY) return null
  return (
    <div className={className}>
      {/* 도전이 필요한 방문자에게는 Cloudflare 가 이 안에 위젯을 그린다 */}
      <div ref={el} hidden={failed} />
      {failed ? (
        <p className={styles.failed} role="alert">
          사람 확인을 불러오지 못했습니다.{' '}
          <button type="button" className={styles.retry} onClick={() => setAttempt((n) => n + 1)}>
            다시 시도
          </button>
        </p>
      ) : (
        <p className={styles.status} data-verified={verified} role="status">
          {verified ? '사람 확인됨' : '사람 확인 중…'}
        </p>
      )}
    </div>
  )
}
