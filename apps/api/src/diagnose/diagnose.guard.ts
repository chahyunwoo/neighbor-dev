// AI 출력 게이트. 프롬프트 지시는 어겨질 수 있으므로 출력을 코드로 한 번 더 검사한다. 테스트하려고 순수 함수로 둔다

export type GuardViolation = 'money' | 'fabricated-record'

export interface GuardResult {
  ok: boolean
  violations: GuardViolation[]
  /** 걸린 대목. 로그에만 쓰고 방문자에게 보내지 않는다 */
  samples: string[]
}

// 기간·규모("3주", "5개 화면")는 통과해야 하므로 화폐 단위를 요구한다
const MONEY_PATTERNS: RegExp[] = [
  // 원\b 금지 — \b 는 한글 경계에서 작동하지 않는다. 뒤에 영숫자가 붙는 경우만 빼 "원본"·"원격" 오탐을 막는다
  // 단위는 겹칠 수 있다("3천만 원") — ? 가 아니라 *
  /\d[\d,.]*\s*(만|억|천|조)*\s*원(?![A-Za-z0-9])/,
  /\d[\d,.]*\s*(만|억|천|조)*\s*달러/,
  /[₩$€¥]\s*\d/,
  /\d[\d,.]*\s*(달러|USD|KRW)\b/i,
  // 숫자 없이 단가·인건비 이야기를 꺼낸 것
  /(인건비|맨먼스|man[- ]?month|MM\s*단가|단가는|견적\s*금액|비용은\s*약)/i,
]

// 1인칭 실적 주장("저희가 …한 적 있습니다")
const FABRICATION_PATTERNS: RegExp[] = [
  /(저희|우리|이웃집 개발자)(가|는|와|과)?\s*[^.\n]{0,40}(만든\s*적|구축한\s*적|개발한\s*적|납품|수행한\s*경험|진행한\s*경험)/,
  /(유사|비슷한)\s*(프로젝트|사례)를?\s*[^.\n]{0,20}(해봤|만들어|진행했)/,
]

export function checkOutput(text: string): GuardResult {
  const violations: GuardViolation[] = []
  const samples: string[] = []

  for (const re of MONEY_PATTERNS) {
    const m = re.exec(text)
    if (m) {
      if (!violations.includes('money')) violations.push('money')
      samples.push(excerpt(text, m.index))
      break
    }
  }
  for (const re of FABRICATION_PATTERNS) {
    const m = re.exec(text)
    if (m) {
      if (!violations.includes('fabricated-record')) violations.push('fabricated-record')
      samples.push(excerpt(text, m.index))
      break
    }
  }

  return { ok: violations.length === 0, violations, samples }
}

function excerpt(text: string, at: number): string {
  return text.slice(Math.max(0, at - 30), at + 60).replace(/\s+/g, ' ')
}
