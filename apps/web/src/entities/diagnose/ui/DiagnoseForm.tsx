'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  /**
   * 스크린리더에게 읽어 줄 현재 상태.
   *
   * 🔴 **이 영역은 처음부터 끝까지 DOM 에 있다.** 조건부로 렌더하면 (a) 삽입과
   *    동시에 내용이 들어가 첫 문구를 놓치고 (b) 결과가 오면 사라져 **결과를
   *    알릴 자리가 없어진다.** 텍스트만 갈아끼운다.
   */
  const [live, setLive] = useState('')
  /**
   * 입력 칸을 **적은 만큼 늘린다.**
   *
   * 🔴 전에는 `resize: vertical` 로 사용자가 끌어 늘이게 했는데, 늘이면 그
   *    아래가 통째로 밀리고 되돌릴 방법도 없었다(사용자 지적).
   *    끌게 하는 대신 내용에 맞춘다 — 상한은 CSS 의 `max-height`(420px)이고,
   *    넘으면 그때부터 칸 안에서 스크롤된다.
   *
   * ⚠️ `scrollHeight` 를 읽기 전에 **높이를 먼저 비워야** 한다. 안 그러면
   *    지금 높이가 바닥이 되어 **줄어들지 않는다**(글을 지워도 칸이 그대로).
   */
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending || tooShort || tooLong) return
    setPending(true)
    setStreaming(true)
    setError(null)
    setResult('')
    setLive('진단을 시작합니다')
    /*
     * 🔴 **실패 여부는 지역 변수로 들고 간다.**
     *    `error` 상태는 이 함수가 닫고 있어(클로저) `finally` 에서 못 읽는다.
     */
    let failed = false
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
            // 🔴 게이트에 걸렸다. 이미 보여준 것을 지운다.
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
      /*
       * 🔴 **끝났다는 것을 알리되, 실패했는데 "결과" 를 말하지 않는다.**
       *
       *    처음에는 "진단이 끝났습니다. 결과를 아래에서 볼 수 있습니다." 를
       *    **무조건** 넣었다. 실패 세 경로 전부에서 `role="alert"` 가 에러를
       *    읽은 **직후** 이 문구가 따라 나왔고, 결과 영역은 없었다 —
       *    스크린리더 사용자가 아래로 내려가 **없는 결과를 찾게 된다.**
       *    무음보다 나쁘다. 무음은 답답하고 이건 거짓이다.
       *
       *    그때 `prev` 를 보는 가드를 달아 두었는데 **항상 참이라 죽어
       *    있었다** — `live` 에 값을 쓰는 곳이 시작 문구와 `STEPS` 뿐이라
       *    `: prev` 분기에 도달할 수 없었다(CLAUDE.md 의 `max(base, 설정)`
       *    죽은 설정과 같은 형태).
       *
       * 🔴 **실패면 polite 영역을 비운다.** 에러는 `role="alert"`(assertive)
       *    가 이미 읽는다. 여기서 또 읽으면 같은 말이 두 번 나온다.
       */
      setLive(failed ? '' : '진단이 끝났습니다. 결과를 아래에서 볼 수 있습니다.')
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

      {/*
       * 🔴 **상시 라이브 영역.** 빈 문자열로 시작해 텍스트만 바뀐다.
       *    `role="status"` 는 암묵적으로 `aria-live="polite"` 다.
       */}
      <p className={styles.srOnly} role="status">
        {live}
      </p>

      {/* ⚠️ 실패는 즉시 알린다 — `role="alert"` 는 assertive 다. */}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {/* 🔴 첫 글자가 오기 전 — 멈춘 것처럼 보이지 않게 한다. */}
      {pending && !result ? <Analyzing onStep={setLive} /> : null}
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

/**
 * 첫 응답이 오기 전의 대기 — **"돌고 있다" 를 보여준다.**
 *
 * 🔴 전에는 버튼 라벨만 "정리하는 중…" 으로 바뀌고 화면은 그대로였다.
 *    모델이 첫 글자를 뱉기까지 몇 초가 걸리는데 그 동안 아무 일도 안 일어나
 *    **멈춘 것처럼 보인다**(사용자 지적: "분석중입니다 같은 그런 인터랙션한
 *    뭔가 나와야 될 거 아니야").
 *
 * ⚠️ 문구는 **하는 일을 순서대로** 적는다. 지어낸 단계가 아니라 프롬프트가
 *    실제로 시키는 순서다(기획서 5절: 범위 → 기술 → 기간 → 위험).
 */
const STEPS = [
  '적어주신 내용을 읽는 중',
  '범위를 나누는 중',
  '기술과 기간을 보는 중',
  '위험한 곳을 찾는 중',
]

/**
 * 지금 읽어 줄 문구. **폼 바깥의 상시 라이브 영역**이 이 값을 읽는다.
 *
 * 🔴 `Analyzing` 자신에게 `aria-live` 를 걸면 안 된다 — 그 요소는 **내용과
 *    동시에 DOM 에 삽입**되고(실측: `t=75ms "라이브영역 통째로 삽입"`),
 *    대부분의 스크린리더는 영역이 **미리 있어야** 읽는다. 게다가 결과가
 *    오면 이 요소가 통째로 사라져 **결과를 알릴 자리가 없어진다**
 *    (실측: 결과 도착 후 `[aria-live],[role=status],[role=alert]` 0개).
 */
function Analyzing({ onStep }: { onStep: (s: string) => void }) {
  const [i, setI] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    /*
     * 🔴 **마지막 단계에서 멈춘다. 처음으로 돌아가지 않는다.**
     *    `% STEPS.length` 로 순환시켰더니 응답이 늦을 때 같은 4문구를
     *    **무한히** 다시 읽었다 — polite 라도 1.8초마다 읽던 자리를 끊는다
     *    (실측: 7776ms 에 첫 문구로 되돌아갔다).
     */
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 1800)
    return () => clearInterval(t)
  }, [])

  // 화면에 보이는 문구와 읽어 주는 문구를 하나로 묶는다.
  useEffect(() => {
    onStep(STEPS[i] ?? '')
  }, [i, onStep])

  /*
   * 🔴 **결과가 생기는 자리로 따라간다.** 폼이 길어서 제출 버튼을 누르면
   *    대기 카드가 **화면 밖 아래**에 생긴다 — 아무 일도 안 일어난 것처럼
   *    보인다(스크린샷으로 확인).
   *
   * ⚠️ `block: 'center'` — 카드를 화면 가운데에 둔다. `start` 로 하면
   *    nav 아래에 딱 붙어 답답하다.
   */
  useEffect(() => {
    /*
     * ⚠️ **움직임을 끈 사람에게는 굴리지 않는다.** `behavior: 'smooth'` 는
     *    `prefers-reduced-motion` 을 스스로 보지 않는다 — 실측: reduce
     *    에뮬레이션에서도 `scrollY 0 → 97` 로 부드럽게 굴렀다.
     */
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
      <p className={styles.analyzingNote}>저장하지 않습니다 · 금액은 말하지 않습니다</p>
    </div>
  )
}
