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
} from '@/entities/diagnose/lib/diagnose-parse'

// 화면이 쓰던 이름을 그대로 다시 내보낸다 — 부르는 쪽을 고치지 않게.
export { buildCopyText, type Section, splitSections } from '@/entities/diagnose/lib/diagnose-parse'

import { RichText } from '@/shared/ui'
import styles from './DiagnoseResult.module.css'

// 스트리밍 중에도 섹션 카드로 쪼갠다. 형식이 어긋난 줄은 버리지 않고 문단으로 떨어진다.

/** 빈 줄이 문단 경계다. 목록 줄은 따로 둔다. */
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

// 끈 항목은 저장하지 않는다 — 화면 상태로만 살고 복사본에 반영된다.
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
      <p className={styles.hint}>1차 개발에서 제외할 항목을 선택하세요. 복사할 때 반영됩니다.</p>
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

/** 높은 등급이 위로 — 읽는 순서가 곧 우선순위다. */
const RISK_ORDER: Record<RiskLevel, number> = { 높음: 0, 중간: 1, 낮음: 2 }

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

// 범위를 못 읽으면 문단 그대로 둔다 — 폭을 지어내지 않는다.
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
        // 마지막 카드는 형식이 반만 왔을 수 있어 다 쓰인 뒤에 인터랙션을 켠다.
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
