'use client'

import { useCallback, useMemo } from 'react'
import {
  isPeriodSection,
  isRiskSection,
  isScopeSection,
  parsePeriod,
  parseRiskLine,
  parseScopeLine,
  type RiskLevel,
  splitSections,
} from '../lib/diagnose-parse'

// 화면이 쓰던 이름을 그대로 다시 내보낸다 — 부르는 쪽을 고치지 않게.
export { buildCopyText, type Section, splitSections } from '../lib/diagnose-parse'

import styles from './DiagnoseResult.module.css'
import { RichText } from './RichText'

/**
 * 자가진단 결과를 섹션 카드로 쪼갠다.
 *
 * 🔴 **스트리밍 중에도 쪼갠다.** 마지막 카드는 아직 쓰이는 중이라 커서가 붙는다 —
 *    "지금 이걸 쓰고 있다" 가 보여야 15초가 기다림이 아니라 과정이 된다.
 *
 * ⚠️ 마크다운 파서를 들이지 않는다. 프롬프트가 형식을 고정하므로
 *    그 몇 가지만 쪼개면 된다 — 파서를 넣으면 링크·이미지까지 렌더되어
 *    정본에 섞인 것이 클릭 가능한 형태로 나갈 수 있다(RichText 와 같은 판단).
 *
 * ⚠️ 형식이 어긋난 줄은 **버리지 않고 문단으로 떨어진다**(`../lib/diagnose-parse`).
 *    스트리밍 도중에는 줄이 반쯤 온 상태가 매번 정상이라, 엄격하게 만들면
 *    화면이 계속 깜빡인다.
 */

/**
 * 본문을 문단으로 나눈다. 빈 줄이 문단 경계다.
 * 목록(`-` 로 시작)은 줄마다 따로 둔다 — 한 덩어리로 묶으면 안 읽힌다.
 */
function toParagraphs(body: string): string[] {
  const out: string[] = []
  let buf: string[] = []
  const flush = () => {
    const joined = buf.join(' ').trim()
    if (joined) out.push(joined)
    buf = []
  }
  for (const line of body.split('\n')) {
    const t = line.trim()
    if (!t) {
      flush()
    } else if (/^[-*·]\s/.test(t)) {
      flush()
      out.push(t)
    } else {
      buf.push(t)
    }
  }
  flush()
  // 같은 문단이 두 번 나오면 key 가 겹친다. 드물지만 막아 둔다.
  return out.map((p, i) => (out.indexOf(p) === i ? p : `${p}​${i}`))
}

/** 문단 목록을 그대로 렌더한다. 형식이 안 맞는 절은 전부 이 경로로 온다. */
function Paragraphs({ body }: { body: string }) {
  return (
    <>
      {toParagraphs(body).map((para) => (
        <p key={para} className={styles.line}>
          <RichText>{para}</RichText>
        </p>
      ))}
    </>
  )
}

/**
 * 범위 절 — 항목을 눌러 1차에서 뺄 수 있다.
 *
 * 🔴 **끈 항목은 저장하지 않는다.** 기획서 5절의 "아무것도 저장하지 않는다" 가
 *    그대로 유효하다 — 선택은 이 화면의 상태로만 살고, 방문자가 복사할 때
 *    복사본에 반영된다(`buildCopyText`). 서버로 보내지 않는다.
 */
function ScopePanel({
  body,
  dropped,
  onToggle,
}: {
  body: string
  dropped: ReadonlySet<string>
  onToggle: (text: string) => void
}) {
  const lines = body.split('\n')
  const items = lines.map((l) => parseScopeLine(l))
  // 하나도 못 읽었으면 형식이 어긋난 것이다. 문단으로 떨어뜨린다.
  if (!items.some((i) => i !== null)) return <Paragraphs body={body} />

  return (
    <>
      <p className={styles.hint}>1차에서 뺄 것을 눌러보세요. 복사할 때 반영됩니다.</p>
      <ul className={styles.scopeList}>
        {items.map((item, i) => {
          const raw = lines[i] ?? ''
          if (!item) {
            const t = raw.trim()
            return t ? (
              <li key={t} className={styles.scopeNote}>
                <RichText>{t}</RichText>
              </li>
            ) : null
          }
          const off = dropped.has(item.text)
          return (
            <li key={item.text}>
              <button
                type="button"
                className={styles.scopeItem}
                data-phase={item.first ? 'first' : 'later'}
                data-off={off}
                onClick={() => onToggle(item.text)}
                aria-pressed={!off}
              >
                <span className={styles.scopeMark} aria-hidden="true" />
                <span className={styles.scopePhase}>{item.first ? '1차' : '2차'}</span>
                <span className={styles.scopeText}>{item.text}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** 등급별 순서. 높은 것이 위로 온다 — 읽는 순서가 곧 우선순위다. */
const RISK_ORDER: Record<RiskLevel, number> = { 높음: 0, 중간: 1, 낮음: 2 }

/** 위험 절 — 등급 배지를 붙인다. */
function RiskPanel({ body }: { body: string }) {
  const lines = body.split('\n')
  const parsed = lines.map((l) => parseRiskLine(l))
  if (!parsed.some((r) => r !== null)) return <Paragraphs body={body} />

  const risks = parsed
    .map((r, i) => ({ r, i }))
    .filter((x): x is { r: NonNullable<typeof x.r>; i: number } => x.r !== null)
    .sort((a, b) => RISK_ORDER[a.r.level] - RISK_ORDER[b.r.level] || a.i - b.i)

  const rest = lines.filter((l, i) => parsed[i] === null && l.trim())

  return (
    <>
      <ul className={styles.riskList}>
        {risks.map(({ r }) => (
          <li key={r.text} className={styles.riskItem} data-level={r.level}>
            <span className={styles.riskBadge}>{r.level}</span>
            <span className={styles.riskText}>
              <RichText>{r.text}</RichText>
            </span>
          </li>
        ))}
      </ul>
      {rest.map((l) => (
        <p key={l.trim()} className={styles.line}>
          <RichText>{l.trim()}</RichText>
        </p>
      ))}
    </>
  )
}

/**
 * 기간 절 — 단일 값이 아니라 범위로 보여준다.
 *
 * 🔴 범위를 못 읽으면 **문단 그대로 둔다.** 폭을 지어내지 않는다.
 */
function PeriodPanel({ body }: { body: string }) {
  const p = parsePeriod(body)
  if (!p) return <Paragraphs body={body} />

  return (
    <>
      <div className={styles.period}>
        <span className={styles.periodTypical}>
          <span className={styles.periodNum}>{p.typical}</span>
          <span className={styles.periodUnit}>주</span>
        </span>
        <span className={styles.periodRange}>
          {p.min}~{p.max}주 사이
        </span>
      </div>
      {p.note ? (
        <p className={styles.line}>
          <RichText>{p.note}</RichText>
        </p>
      ) : null}
    </>
  )
}

export function DiagnoseResult({
  text,
  streaming,
  dropped,
  onToggleScope,
}: {
  text: string
  /** 아직 쓰이는 중인가. 마지막 카드에 커서를 붙인다. */
  streaming: boolean
  /** 방문자가 1차에서 뺀 범위 항목. */
  dropped?: ReadonlySet<string>
  onToggleScope?: (text: string) => void
}) {
  const { intro, sections } = splitSections(text)
  const empty = useMemo(() => new Set<string>(), [])
  const off = dropped ?? empty
  const toggle = useCallback((t: string) => onToggleScope?.(t), [onToggleScope])

  return (
    <div className={styles.wrap}>
      {intro ? <p className={styles.intro}>{intro}</p> : null}
      {sections.map((section, i) => {
        const isLast = i === sections.length - 1
        // 🔴 마지막 카드는 아직 쓰이는 중이라 형식이 반만 왔을 수 있다.
        //    그 상태에서 목록으로 붙였다 뗐다 하면 화면이 흔들리므로,
        //    다 쓰이고 나서 인터랙션을 켠다.
        const settled = !(streaming && isLast)
        return (
          <section key={section.title} className={styles.card} data-streaming={streaming && isLast}>
            <div className={styles.head}>
              <span className={styles.no}>{String(i + 1).padStart(2, '0')}</span>
              <h3 className={styles.title}>{section.title}</h3>
            </div>
            <div className={styles.body}>
              {settled && isScopeSection(section.title) ? (
                <ScopePanel body={section.body} dropped={off} onToggle={toggle} />
              ) : settled && isRiskSection(section.title) ? (
                <RiskPanel body={section.body} />
              ) : settled && isPeriodSection(section.title) ? (
                <PeriodPanel body={section.body} />
              ) : (
                <Paragraphs body={section.body} />
              )}
              {streaming && isLast ? <span className={styles.cursor} aria-hidden="true" /> : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
