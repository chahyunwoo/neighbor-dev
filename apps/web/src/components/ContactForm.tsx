'use client'

import { useEffect, useState } from 'react'
import styles from './ContactForm.module.css'

/** 자가진단 결과를 문의로 넘길 때 쓰는 열쇠. 화면 사이에서만 쓴다. */
export const DIAGNOSIS_KEY = 'neighbor:diagnosis'

const MIN_MESSAGE = 20
const MAX_MESSAGE = 8000

/**
 * 문의 폼.
 *
 * 🔴 받는 항목을 최소로 둔다 — 이름·이메일·내용뿐이다. 회사명도 전화번호도
 *    묻지 않는다. 필요하면 답장에서 물어보면 되고, 안 받은 개인정보는
 *    지킬 필요도 없다.
 *
 * 🔴 저장하지 않는다. api 가 메일로 넘기고 끝낸다.
 */
export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [diagnosis, setDiagnosis] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // 자가진단에서 넘어온 결과가 있으면 붙인다.
  // sessionStorage 를 쓰는 이유: 탭을 닫으면 사라진다 — 남겨둘 이유가 없다.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DIAGNOSIS_KEY)
      if (saved) setDiagnosis(saved)
    } catch {
      // 저장소가 막힌 환경이 있다. 없으면 없는 대로 동작한다.
    }
  }, [])

  const tooShort = message.trim().length < MIN_MESSAGE
  const tooLong = message.length > MAX_MESSAGE
  const invalid = name.trim().length < 2 || !email.includes('@') || tooShort || tooLong

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending || invalid) return
    setPending(true)
    setResult(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          ...(diagnosis ? { diagnosis } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message[0] : data.message
        setResult({ kind: 'error', text: msg ?? '지금은 접수가 되지 않습니다.' })
        return
      }
      setResult({
        kind: 'ok',
        text: '보냈습니다. 하루 안에 답장드리겠습니다 — 주말이면 조금 늦어질 수 있어요.',
      })
      setName('')
      setEmail('')
      setMessage('')
      setDiagnosis(null)
      try {
        sessionStorage.removeItem(DIAGNOSIS_KEY)
      } catch {
        // 위와 같다.
      }
    } catch {
      setResult({ kind: 'error', text: '연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <form className={styles.wrap} onSubmit={submit}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="contact-name">
            어떻게 부르면 될까요
          </label>
          <input
            id="contact-name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 또는 회사"
            disabled={pending}
            autoComplete="name"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="contact-email">
            답장을 어디로 보낼까요
          </label>
          <input
            id="contact-email"
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={pending}
            autoComplete="email"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="contact-message">
          무엇을 만들고 싶으신가요. 정리되지 않아도 괜찮습니다.
        </label>
        <textarea
          id="contact-message"
          className={styles.textarea}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            '예) 헬스장 회원 관리 웹이 필요합니다.\n지금은 엑셀로 하고 있는데 출석이랑 이용권 만료를 놓치는 일이 잦아요.\n일정은 급하지 않고, 예산은 아직 못 정했습니다.'
          }
          disabled={pending}
        />
      </div>

      {diagnosis ? (
        <div className={styles.attached}>
          <span>자가진단 결과를 함께 보냅니다 ({diagnosis.length}자)</span>
          <button type="button" className={styles.detach} onClick={() => setDiagnosis(null)}>
            빼기
          </button>
        </div>
      ) : null}

      {result ? (
        <p className={styles.message} data-kind={result.kind}>
          {result.text}
        </p>
      ) : null}

      <div className={styles.foot}>
        <span className={styles.note}>
          받은 내용은 답장에만 씁니다. 저장하지 않습니다.
          {tooLong ? ` · ${MAX_MESSAGE.toLocaleString()}자 안쪽으로 적어주세요` : ''}
        </span>
        <button className={styles.submit} type="submit" disabled={pending || invalid}>
          {pending ? '보내는 중…' : '문 두드리기'}
        </button>
      </div>
    </form>
  )
}
