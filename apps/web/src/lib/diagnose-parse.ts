/**
 * 자가진단 결과 파서 (기획서 5절).
 *
 * 🔴 **순수 함수만 둔다.** 그래야 "이 파서가 실제로 무엇을 잡는가" 를
 *    테스트로 확인할 수 있다. React 를 들이면 그 확인이 어려워진다.
 *
 * ⚠️ 형식은 `apps/api/src/diagnose/diagnose.prompt.ts` 가 만든다.
 *    한쪽만 고치면 인터랙션이 조용히 사라진다 — 형식이 어긋나면
 *    **깨지지 않고 평범한 문단으로 떨어진다**(아래 각 함수가 그렇게 만든다).
 *    이게 의도다. 스트리밍 도중에는 줄이 반쯤 온 상태가 정상이라,
 *    "형식에 안 맞으면 버린다" 로 만들면 화면이 계속 깜빡인다.
 *
 * ⚠️ 마크다운 파서를 들이지 않는다. 프롬프트가 형식을 고정하므로 그
 *    몇 가지만 보면 된다 — 파서를 넣으면 링크·이미지까지 렌더되어
 *    정본에 섞인 것이 클릭 가능한 형태로 나갈 수 있다(RichText 와 같은 판단).
 */

/** 범위 항목. `- [먼저] 회원 등록` 한 줄이 하나다. */
export interface ScopeItem {
  /** 1차에 넣을 것인가. `[먼저]` 면 true, `[나중]` 이면 false. */
  first: boolean
  text: string
}

/** 위험 항목. `- [높음] …` 한 줄이 하나다. */
export type RiskLevel = '높음' | '중간' | '낮음'
export interface RiskItem {
  level: RiskLevel
  text: string
}

/** 기간. `8주 (6~10)` 또는 `6주 (4~9주)` 둘 다 받는다. */
export interface Period {
  typical: number
  min: number
  max: number
  /** 폭에 대한 설명. 없을 수 있다. */
  note: string
}

const RISK_LEVELS: RiskLevel[] = ['높음', '중간', '낮음']

/**
 * 범위 목록을 뽑는다.
 *
 * ⚠️ 대괄호는 `[`·`［` 둘 다 받는다 — 모델이 전각을 쓰는 경우가 있다.
 *    형식에 안 맞는 줄은 `null` 이 되어 호출부가 문단으로 렌더한다.
 */
export function parseScopeLine(line: string): ScopeItem | null {
  const m = /^[-*·]\s*[[［]\s*(먼저|나중)\s*[\]］]\s*(.+)$/.exec(line.trim())
  if (!m) return null
  const text = (m[2] ?? '').trim()
  if (!text) return null
  return { first: m[1] === '먼저', text }
}

/** 위험 항목 한 줄을 뽑는다. 등급이 없으면 `null`. */
export function parseRiskLine(line: string): RiskItem | null {
  const m = /^[-*·]\s*[[［]\s*(높음|중간|낮음)\s*[\]］]\s*(.+)$/.exec(line.trim())
  if (!m) return null
  const text = (m[2] ?? '').trim()
  if (!text) return null
  const level = m[1] as RiskLevel
  if (!RISK_LEVELS.includes(level)) return null
  return { level, text }
}

/**
 * 기간 절의 본문에서 범위를 뽑는다.
 *
 * 받는 형태 (실측 2026-09-09: 모델이 괄호 안에도 "주" 를 붙이는 경우가 있다):
 *   `8주 (6~10)` · `6주 (4~9주)` · `8주(6-10주)` · `8 주 ( 6 ~ 10 )`
 *
 * 🔴 범위가 없으면 `null` 이다 — 단일 값(`8주`)만 왔으면 범위로 만들지 않는다.
 *    없는 폭을 지어내면 그게 곧 근거 없는 수치다.
 */
export function parsePeriod(body: string): Period | null {
  const m = /(\d+)\s*주\s*[(（]\s*(\d+)\s*(?:주)?\s*[~〜\-–—]\s*(\d+)\s*(?:주)?\s*[)）]/.exec(body)
  if (!m) return null
  const typical = Number(m[1])
  const min = Number(m[2])
  const max = Number(m[3])
  // 뒤집힌 범위는 받지 않는다. 화면에 "10~6주" 가 나가면 그게 더 나쁘다.
  if (!(min <= max)) return null

  // 범위 표기가 있던 줄을 뺀 나머지가 설명이다.
  const note = body
    .split('\n')
    .filter((l) => !l.includes(m[0]))
    .join(' ')
    .trim()

  return { typical, min, max, note }
}

/** 절 제목이 범위 절인가. 앞머리 숫자는 이미 떼인 상태로 들어온다. */
export function isScopeSection(title: string): boolean {
  return title.includes('범위')
}

/** 절 제목이 위험 절인가. */
export function isRiskSection(title: string): boolean {
  return title.includes('위험') || title.includes('오래 걸리')
}

/** 절 제목이 기간 절인가. */
export function isPeriodSection(title: string): boolean {
  return title.trim() === '기간' || title.includes('기간')
}

export interface Section {
  /** `## ` 뒤의 제목. 앞머리 숫자는 뗀다. */
  title: string
  body: string
}

/** 텍스트를 `## 제목` 단위로 쪼갠다. 제목 앞의 도입부는 버리지 않고 첫 칸에 둔다. */
export function splitSections(text: string): { intro: string; sections: Section[] } {
  const lines = text.split('\n')
  const sections: Section[] = []
  const intro: string[] = []
  let current: Section | null = null

  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m) {
      if (current) sections.push(current)
      // "1. 무엇을 만드는 것인지" → "무엇을 만드는 것인지"
      current = { title: (m[1] ?? '').replace(/^\d+\.\s*/, ''), body: '' }
      continue
    }
    if (current) current.body += `${line}\n`
    else intro.push(line)
  }
  if (current) sections.push(current)

  return {
    intro: intro.join('\n').trim(),
    sections: sections.map((s) => ({ ...s, body: s.body.trim() })),
  }
}

/**
 * 복사본을 만든다.
 *
 * 🔴 방문자가 끈 항목을 **2차로 옮겨** 적는다. 지우지 않는다 —
 *    "이건 지금 안 한다" 와 "이건 아예 필요 없다" 는 다르고,
 *    상담에서는 그 구분이 정보다.
 *
 * ⚠️ 원문을 통째로 바꾸지 않는다. 범위 절의 해당 줄만 표시를 바꾼다.
 */
export function buildCopyText(text: string, dropped: ReadonlySet<string>): string {
  if (dropped.size === 0) return text

  const { sections } = splitSections(text)
  const scopeTitles = new Set(sections.filter((s) => isScopeSection(s.title)).map((s) => s.title))
  if (scopeTitles.size === 0) return text

  let inScope = false
  const out = text.split('\n').map((line) => {
    const h = /^##\s+(.+?)\s*$/.exec(line)
    if (h) {
      inScope = scopeTitles.has((h[1] ?? '').replace(/^\d+\.\s*/, ''))
      return line
    }
    if (!inScope) return line
    const item = parseScopeLine(line)
    if (!item || !dropped.has(item.text)) return line
    return `- [나중] ${item.text}  (방문자가 1차에서 뺌)`
  })

  return out.join('\n')
}
