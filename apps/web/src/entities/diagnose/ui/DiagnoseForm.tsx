'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Turnstile, turnstileEnabled } from '@/shared/ui'
import styles from './DiagnoseForm.module.css'
import { buildCopyText, DiagnoseResult } from './DiagnoseResult'

const MIN = 20
const MAX = 4000

/** 자가진단 입력 폼. 아무것도 저장하지 않는다 — 결과는 화면과 복사본에만 남는다. */
export function DiagnoseForm() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  // 화면 상태로만 산다 — 서버로 보내거나 저장하지 않는다.
  const [dropped, setDropped] = useState<ReadonlySet<string>>(() => new Set())
  // 라이브 영역은 처음부터 DOM 에 둔다 — 조건부로 렌더하면 첫 문구와 결과 알림을 놓친다.
  const [live, setLive] = useState('')
  // 적은 만큼 늘린다. scrollHeight 를 읽기 전에 높이를 비워야 줄어든다.
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  const toggleScope = useCallback((item: string) => {
    setDropped((prev) => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
  }, [])

  const tooShort = text.trim().length < MIN
  const tooLong = text.length > MAX
  const unverified = turnstileEnabled && !token

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending || tooShort || tooLong || unverified) return
    setPending(true)
    setStreaming(true)
    setError(null)
    setResult('')
    setLive('진단을 시작합니다')
    // error 상태는 클로저라 finally 에서 못 읽는다 — 지역 변수로 들고 간다.
    let failed = false
    // 앞 진단에서 뺀 항목이 새 결과에 남으면 엉뚱한 것이 꺼진 채로 보인다.
    setDropped(new Set())
    try {
      const res = await fetch('/api/diagnose/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: text.trim(), turnstileToken: token ?? undefined }),
      })

      // 캡에 걸렸거나 준비 중이면 api 가 JSON 으로 답한다.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        const msg = Array.isArray(data.message) ? data.message[0] : data.message
        failed = true
        setError(msg ?? '지금은 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.')
        return
      }

      // SSE 를 직접 읽는다. EventSource 는 GET 만 되므로 쓸 수 없다.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // 이벤트는 빈 줄로 구분된다. 마지막 조각은 아직 안 끝났을 수 있어 남긴다.
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const chunk of events) {
          const line = chunk.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          const payload = JSON.parse(line.slice(6))

          if (typeof payload.text === 'string') {
            acc += payload.text
            setResult(acc)
          } else if (payload.ok === false) {
            // 게이트에 걸렸다. 이미 보여준 것을 지운다.
            failed = true
            setResult(null)
            setError(payload.message ?? '결과를 만들지 못했습니다.')
          } else if (payload.message) {
            failed = true
            setResult(null)
            setError(payload.message)
          }
        }
      }
    } catch {
      failed = true
      setError('연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPending(false)
      setStreaming(false)
      setResetKey((k) => k + 1)
      // 실패면 비운다 — 에러는 role="alert" 가 읽고, 여기서 "결과" 를 말하면 거짓이 된다.
      setLive(failed ? '' : '진단이 끝났습니다. 결과를 아래에서 볼 수 있습니다.')
    }
  }

  // 결과를 자동으로 실어 보내지 않는다 — 클립보드에 담고 방문자가 직접 붙여넣는다.
  async function goToContact() {
    if (result) {
      try {
        await navigator.clipboard.writeText(buildCopyText(result, dropped))
      } catch {
        // 클립보드가 막힌 환경이 있다. 그래도 문의 화면으로는 간다.
      }
    }
    router.push('/contact')
  }

  async function copy() {
    if (!result) return
    try {
      // 방문자가 뺀 항목이 복사본에 반영된다.
      await navigator.clipboard.writeText(buildCopyText(result, dropped))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드가 막힌 환경이 있다. 실패해도 화면은 그대로 두면 된다.
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.wrap} onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="requirement">
            만들고 싶은 서비스를 적어주세요. 정리되지 않은 상태여도 됩니다.
          </label>
          <textarea
            id="requirement"
            ref={box}
            className={styles.textarea}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
            placeholder={
              '예) 동네 헬스장에서 쓸 회원 관리 웹을 만들고 싶습니다.\n회원 등록하고, 출석 체크하고, 이용권 남은 기간을 보는 정도요.\n관리자는 두세 명이고 회원은 300명쯤 됩니다.'
            }
            disabled={pending}
          />
        </div>
        <Turnstile onToken={setToken} resetKey={resetKey} />
        <div className={styles.row}>
          <span className={styles.count} data-over={tooLong}>
            {text.length} / {MAX}
            {tooShort && text.length > 0 ? ` · ${MIN}자 이상 적어주세요` : ''}
          </span>
          <button
            className={styles.submit}
            type="submit"
            disabled={pending || tooShort || tooLong || unverified}
          >
            {pending ? '분석 중…' : '진단 시작'}
          </button>
        </div>
      </form>

      {/* 상시 라이브 영역 — 텍스트만 바뀐다. */}
      <p className={styles.srOnly} role="status">
        {live}
      </p>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {pending && !result ? <Analyzing onStep={setLive} /> : null}
      {result ? (
        <div>
          <div className={styles.resultHead}>
            <span className={styles.resultTitle}>
              {streaming ? '분석 중…' : '진단 결과 · 저장되지 않음'}
            </span>
            {!streaming ? (
              <span className={styles.actions}>
                <button className={styles.copy} type="button" onClick={copy}>
                  {copied ? '복사됨' : '복사'}
                </button>
                <button className={styles.send} type="button" onClick={goToContact}>
                  결과 복사 후 문의하기 →
                </button>
              </span>
            ) : null}
          </div>
          <DiagnoseResult
            text={result}
            streaming={streaming}
            dropped={dropped}
            onToggleScope={toggleScope}
          />
        </div>
      ) : null}
    </div>
  )
}

// 프롬프트가 실제로 시키는 순서다. 지어낸 단계를 넣지 않는다.
const STEPS = ['입력 내용 분석', '개발 범위 분할', '기술 스택·기간 산정', '리스크 검토']

// Analyzing 자신에 aria-live 를 걸지 않는다 — 내용과 동시에 삽입되고 결과가 오면 사라진다.
function Analyzing({ onStep }: { onStep: (s: string) => void }) {
  const [i, setI] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 마지막 단계에서 멈춘다 — 순환하면 응답이 늦을 때 같은 문구를 계속 읽는다.
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 1800)
    return () => clearInterval(t)
  }, [])

  // 화면에 보이는 문구와 읽어 주는 문구를 하나로 묶는다.
  useEffect(() => {
    onStep(STEPS[i] ?? '')
  }, [i, onStep])

  // 폼이 길어 대기 카드가 화면 밖에 생기므로 그 자리로 굴린다.
  useEffect(() => {
    // smooth 는 prefers-reduced-motion 을 스스로 보지 않는다.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }, [])

  return (
    <div ref={ref} className={styles.analyzing}>
      <div className={styles.scan} aria-hidden="true" />
      <p className={styles.analyzingText}>
        {STEPS[i]}
        <span className={styles.dots} aria-hidden="true" />
      </p>
      <p className={styles.analyzingNote}>입력 내용 저장 안 함 · 견적 금액 미포함</p>
    </div>
  )
}
