/**
 * 공개 데이터 정제 — 원본이 담고 있으나 이 채널에 나가면 안 되는 표현을 바꾼다.
 *
 * **지우는 것이 아니라 바꾸는 것**이 원칙이다. 실적과 설계 판단은 살리고,
 * 식별자·주소만 중립 표현으로 바꾼다(전역 규칙: "말하지 않을 뿐, 거짓으로 쓰지 않는다").
 *
 * 🔴 이 파일에 개인 도메인을 문자열 상수로 적지 않는다 — 조각으로 조립한다.
 *    (CLAUDE.md: 저장소가 PUBLIC 이라 파일 자체가 유출 지점이 된다.)
 */

/** 개인 사이트 도메인. 상수로 박지 않고 조립한다. */
const PERSONAL_DOMAIN = ['hyunwoo', 'dev'].join('.')

/**
 * 개인 사이트 4건의 익명 라벨.
 * 도메인을 빼되 "개인 자산"이라는 사실은 남긴다 — 실적을 숨기는 것이 아니다.
 *
 * ⚠️ `hyunwoo-dev-web` 은 이력서 PDF 생성을 라벨에서 뺀다.
 *    CLAUDE.md 4번: 실명·연락처가 들어가는 기능이라 옮기지 않는다.
 */
const ANONYMOUS_LABELS = {
  // 기획서 11절이 표기를 이미 정해뒀다: "커머스 플랫폼 주문 검증 시스템".
  // 원본 라벨에는 플랫폼 실명이 들어 있다 — 실측(2026-09-09) 화면에서 발견.
  'cafe24-playbook': '커머스 플랫폼 주문 검증 시스템 — 주문 데이터 실시간 검증',
  'hyunwoo-dev-admin': '개인 기술 사이트 어드민 — 콘텐츠·포트폴리오 운영 콘솔',
  'hyunwoo-dev-blog': '개인 기술 블로그 — 파일 기반 MDX를 걷어내고 API 콘텐츠로 전환',
  'hyunwoo-dev-monorepo':
    '개인 기술 사이트 모노레포 — 앱 3개 공통 인프라와 OpenAPI 타입 파이프라인',
  'hyunwoo-dev-web': '개인 기술 사이트 프론트 — Three.js 인터랙티브 원페이지',
}

/**
 * 표현 치환. 앞이 긴 것부터 적용해야 부분 치환으로 깨지지 않는다.
 * 각 항목은 [찾을 것, 바꿀 것, 왜] 형태다 — 이유가 없는 치환은 넣지 않는다.
 */
const REPLACEMENTS = [
  // 개인 스코프 패키지명. 스택 태그에 그대로 실려 개인 사이트를 식별시켰다
  // (실측 2026-09-09: `shadcn/ui (Radix Primitives) — @hyunwoo/ui`).
  // 🔴 데이터 검사는 통과했다 — 화면을 눈으로 보고서야 잡혔다.
  [/\s*[—-]\s*@hyunwoo\/[\w-]+/g, '', '개인 스코프 패키지명 — 설명 꼬리째 뗀다'],
  [/@hyunwoo\/[\w-]+/g, '자체 공통 패키지', '남은 단독 언급'],
  // 플랫폼 실명 — 기획서 11절이 익명 표기를 정해뒀다.
  [/카페24|Cafe24|CAFE24/g, '커머스 플랫폼', '플랫폼 실명 비노출'],
  // 루프백 주소는 사설 IP 검사에 걸리지만, 실제로는 "외부로 열지 않았다"는 설계 판단이다.
  // 판단을 살리기 위해 값을 표현으로 바꾼다.
  // ⚠️ 뒤에 이미 "전용 바인딩" 이 붙은 경우를 먼저 처리한다 — 그러지 않으면
  //    `127.0.0.1 전용 바인딩` 이 `로컬 전용 바인딩 전용 바인딩` 이 된다(실측).
  [/`?127\.0\.0\.1`?\s*전용 바인딩/g, '로컬 전용 바인딩', '중복 방지'],
  [/`?localhost`?\s*전용 바인딩/g, '로컬 전용 바인딩', '중복 방지'],
  [/`?127\.0\.0\.1`?/g, '로컬 전용 바인딩', '루프백 주소 → 설계 표현'],
  [/`?localhost`?(:\d+)?/g, '로컬 전용 바인딩', '동상'],
  // 개인 도메인은 어디에 나오든 중립 표현으로.
  [new RegExp(PERSONAL_DOMAIN.replace('.', '\\.'), 'g'), '개인 기술 사이트', '개인 도메인 비노출'],
]

/** 문자열 하나를 정제한다. */
export function sanitizeString(text) {
  let out = text
  for (const [find, replace] of REPLACEMENTS) out = out.replace(find, replace)
  return out
}

/** 객체/배열/문자열을 재귀적으로 정제한다. 키는 건드리지 않는다. */
export function sanitizeDeep(value) {
  if (typeof value === 'string') return sanitizeString(value)
  if (Array.isArray(value)) return value.map(sanitizeDeep)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v)
    return out
  }
  return value
}

/** 이 id 에 지정된 익명 라벨이 있으면 그것을 쓴다. */
export function anonymousLabelFor(id) {
  return ANONYMOUS_LABELS[id]
}
