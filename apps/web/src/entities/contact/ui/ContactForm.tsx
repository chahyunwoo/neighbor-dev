'use client'

import Link from 'next/link'
import { useState } from 'react'
import styles from './ContactForm.module.css'

const MIN_MESSAGE = 20
const MAX_MESSAGE = 8000

// 받는 항목은 이름·이메일·내용뿐이다. 서버에 저장하지 않고 메일로만 넘긴다(보유 기간은 /privacy).
export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const tooShort = message.trim().length < MIN_MESSAGE
  const tooLong = message.length > MAX_MESSAGE
  const invalid = name.trim().length < 2 || !email.includes('@') || tooShort || tooLong || !agreed

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
        text: '접수되었습니다. 영업일 기준 1일 이내에 답변드리겠습니다.',
      })
      setName('')
      setEmail('')
      setMessage('')
      setAgreed(false)
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
            이름 또는 회사명
          </label>
          <input
            id="contact-name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 홍길동"
            disabled={pending}
            autoComplete="name"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="contact-email">
            회신 받을 이메일
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
          문의 내용
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

      <div className={styles.consent}>
        <p className={styles.consentText}>
          수집 항목: 이름(또는 회사명), 이메일, 문의 내용 · 목적: 문의 확인과 회신 · 보유: 문의 처리
          후 1년. 문의 메일은 Google Workspace 로 수신·보관됩니다.{' '}
          <Link href="/privacy">개인정보처리방침</Link>
        </p>
        <label className={styles.consentCheck}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={pending}
          />
          개인정보 수집·이용에 동의합니다 (필수)
        </label>
      </div>

      {result ? (
        <p
          className={styles.message}
          data-kind={result.kind}
          role={result.kind === 'error' ? 'alert' : 'status'}
        >
          {result.text}
        </p>
      ) : null}

      <div className={styles.foot}>
        <span className={styles.note}>
          문의 내용은 서버에 저장하지 않고 메일로만 전달됩니다.
          {tooLong ? ` · ${MAX_MESSAGE.toLocaleString()}자 안쪽으로 적어주세요` : ''}
        </span>
        <button className={styles.submit} type="submit" disabled={pending || invalid}>
          {pending ? '보내는 중…' : '문의 보내기'}
        </button>
      </div>
    </form>
  )
}
