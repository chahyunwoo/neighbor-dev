'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DIAGNOSIS_KEY } from './ContactForm'
import styles from './DiagnoseForm.module.css'

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
  const [copied, setCopied] = useState(false)

  const tooShort = text.trim().length < MIN
  const tooLong = text.length > MAX

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending || tooShort || tooLong) return
    setPending(true)
    setError(null)
    setResult(null)
    try {
      // 🔴 상대 경로다. api 주소가 브라우저로 나가지 않는다(app/api/diagnose/route.ts).
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: text.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        // 서버가 보낸 안내를 그대로 쓴다 — 캡·게이트 안내가 이미 사람 말로 되어 있다.
        const msg = Array.isArray(data.message) ? data.message[0] : data.message
        setError(msg ?? '지금은 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      setResult(data.result)
    } catch {
      setError('연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPending(false)
    }
  }

  /**
   * 결과를 문의로 넘긴다 (기획서 5절 "이 결과를 문의에 붙여넣기").
   *
   * 🔴 서버에 저장하지 않는다. sessionStorage 에 잠깐 두고 문의 화면이
   *    집어간다 — 탭을 닫으면 사라진다.
   */
  function sendToContact() {
    if (!result) return
    try {
      sessionStorage.setItem(DIAGNOSIS_KEY, result)
    } catch {
      // 저장소가 막혔으면 그냥 문의 화면으로 간다. 결과는 복사로 옮기면 된다.
    }
    router.push('/contact')
  }

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
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
            <span className={styles.resultTitle}>[ 자가진단 결과 · 저장하지 않습니다 ]</span>
            <span className={styles.actions}>
              <button className={styles.copy} type="button" onClick={copy}>
                {copied ? '복사됨' : '복사'}
              </button>
              <button className={styles.send} type="button" onClick={sendToContact}>
                이 결과로 문의하기 →
              </button>
            </span>
          </div>
          <div className={styles.result}>{result}</div>
        </div>
      ) : null}
    </div>
  )
}
