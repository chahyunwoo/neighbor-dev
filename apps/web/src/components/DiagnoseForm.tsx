'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import styles from './DiagnoseForm.module.css'
import { buildCopyText, DiagnoseResult } from './DiagnoseResult'

const MIN = 20
const MAX = 4000

/**
 * 자가진단 입력 폼 (기획서 5절).
 *
 * 🔴 아무것도 저장하지 않는다 — 결과는 화면에만 남고, 방문자가 스스로
 *    문의에 붙여넣을 수 있게 복사 버튼만 둔다. 이메일도 PDF 도 없다.
 *
 * ⚠️ 이 컴포넌트는 클라이언트 전용이라 JS 가 꺼져 있으면 동작하지 않는다.
 *    그래서 부모(page.tsx)가 서버 렌더로 "무엇을 하는 기능인지" 를 먼저 설명한다 —
 *    JS 없이도 페이지의 뜻은 읽힌다.
 */
export function DiagnoseForm() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  /**
   * 방문자가 1차에서 뺀 범위 항목.
   *
   * 🔴 화면 상태로만 산다. 서버로 보내지 않고 저장하지도 않는다 —
   *    기획서 5절의 "아무것도 저장하지 않는다" 가 그대로 유효하다.
   *    복사할 때만 복사본에 반영된다.
   */
  const [dropped, setDropped] = useState<ReadonlySet<string>>(() => new Set())

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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending || tooShort || tooLong) return
    setPending(true)
    setStreaming(true)
    setError(null)
    setResult('')
    // 앞 진단에서 뺀 항목이 새 결과에 남으면 엉뚱한 것이 꺼진 채로 보인다.
    setDropped(new Set())
    try {
      const res = await fetch('/api/diagnose/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: text.trim() }),
      })

      // 캡에 걸렸거나 준비 중이면 api 가 JSON 으로 답한다.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        const msg = Array.isArray(data.message) ? data.message[0] : data.message
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
            // 🔴 게이트에 걸렸다. 이미 보여준 것을 지운다.
            setResult(null)
            setError(payload.message ?? '결과를 만들지 못했습니다.')
          } else if (payload.message) {
            setResult(null)
            setError(payload.message)
          }
        }
      }
    } catch {
      setError('연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPending(false)
      setStreaming(false)
    }
  }

  /**
   * 결과를 들고 문의로 간다.
   *
   * 🔴 결과를 **자동으로 실어 보내지 않는다**(2026-09-09 사용자 확정).
   *    메일은 문의 정보만 담는다. 대신 클립보드에 담아 주고, 방문자가
   *    필요하다고 판단하면 본문에 직접 붙여넣는다 — 무엇이 전달될지
   *    방문자가 알고 고르게 한다.
   */
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
      // 🔴 방문자가 뺀 항목이 복사본에 반영된다 — 그 선택 자체가 상담 입력이다.
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
            만들고 싶은 것을 적어주세요. 정리되지 않아도 괜찮습니다.
          </label>
          <textarea
            id="requirement"
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              '예) 동네 헬스장에서 쓸 회원 관리 웹을 만들고 싶습니다.\n회원 등록하고, 출석 체크하고, 이용권 남은 기간을 보는 정도요.\n관리자는 두세 명이고 회원은 300명쯤 됩니다.'
            }
            disabled={pending}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.count} data-over={tooLong}>
            {text.length} / {MAX}
            {tooShort && text.length > 0 ? ` · ${MIN}자 이상 적어주세요` : ''}
          </span>
          <button className={styles.submit} type="submit" disabled={pending || tooShort || tooLong}>
            {pending ? '정리하는 중…' : '진단해보기'}
          </button>
        </div>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      {result ? (
        <div>
          <div className={styles.resultHead}>
            <span className={styles.resultTitle}>
              {streaming ? '[ 정리하는 중… ]' : '[ 자가진단 결과 · 저장하지 않습니다 ]'}
            </span>
            {!streaming ? (
              <span className={styles.actions}>
                <button className={styles.copy} type="button" onClick={copy}>
                  {copied ? '복사됨' : '복사'}
                </button>
                <button className={styles.send} type="button" onClick={goToContact}>
                  복사해서 문의하기 →
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
