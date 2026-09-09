/**
 * AI 출력 게이트 (기획서 5절 "절대 하지 않을 것").
 *
 * 🔴 프롬프트로 막았다고 보지 않는다. 모델은 지시를 어길 수 있고 이 화면은
 *    상시 공개다. 전역 규칙 5절과 같은 형태다 — 게이트는 우회 불가능한
 *    수단으로 만든다.
 *
 * 순수 함수만 둔다. 그래야 테스트로 "이 게이트가 실제로 잡는가" 를 확인할 수 있다.
 */

export type GuardViolation = 'money' | 'fabricated-record'

export interface GuardResult {
  ok: boolean
  violations: GuardViolation[]
  /** 걸린 대목. 로그에만 쓰고 방문자에게 보내지 않는다. */
  samples: string[]
}

/**
 * 금액 표현.
 *
 * ⚠️ 기간·규모를 금액으로 오인하지 않게 화폐 단위를 요구한다.
 *    "3주", "5개 화면" 은 통과해야 한다 — 그건 프롬프트가 시키는 일이다.
 */
const MONEY_PATTERNS: RegExp[] = [
  // 숫자 + 화폐 단위: "500만원", "1,200,000원", "3천만 원"
  //
  // ⚠️ `원\b` 를 쓰지 않는다. **`\b` 는 한글 경계에서 작동하지 않는다** —
  //    `원` 이 \w 가 아니라 경계 판정이 뒤집혀서 `1,200,000원 수준입니다` 를
  //    통째로 놓친다(실측 2026-09-09, 테스트가 잡았다).
  //    대신 뒤에 숫자·영문이 붙는 경우만 제외해 "원본"·"원격" 오탐을 막는다.
  //    단위는 겹쳐 쓴다 — "3천만 원" 은 천과 만이 함께 온다(실측: `?` 하나로는
  //    이 형태를 놓쳤다). `*` 로 반복을 허용하되 오탐은 없다(테스트로 확인).
  /\d[\d,.]*\s*(만|억|천|조)*\s*원(?![A-Za-z0-9])/,
  /\d[\d,.]*\s*(만|억|천|조)*\s*달러/,
  // 통화 기호
  /[₩$€¥]\s*\d/,
  /\d[\d,.]*\s*(달러|USD|KRW)\b/i,
  // 단가·인건비 표현 (숫자 없이도 금액 이야기를 꺼낸 것)
  /(인건비|맨먼스|man[- ]?month|MM\s*단가|단가는|견적\s*금액|비용은\s*약)/i,
]

/**
 * 실적 날조.
 * "저희가 …한 적 있습니다" 류의 1인칭 실적 주장을 잡는다.
 */
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
