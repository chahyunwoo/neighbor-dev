// 공개 데이터 정제 — 지우지 않고 식별자·주소만 중립 표현으로 바꾼다(실적과 설계 판단은 살린다)
// 저장소가 PUBLIC 이라 개인 도메인을 문자열 상수로 적지 않는다 — 조각으로 조립한다

const PERSONAL_DOMAIN = ['hyunwoo', 'dev'].join('.')

// 공개 URL 에 쓰는 id — 저장소명(도메인이 읽히는 하이픈 형태)을 주소·RSC 페이로드로 내보내지 않는다. 없는 id 는 그대로
const PUBLIC_IDS = {
  'hyunwoo-dev-admin': 'personal-site-admin',
  'hyunwoo-dev-blog': 'personal-blog',
  'hyunwoo-dev-monorepo': 'personal-site-monorepo',
  'hyunwoo-dev-web': 'personal-site-web',
}

export function publicIdFor(id) {
  return PUBLIC_IDS[id] ?? id
}

// 이 5건은 정본 headline 대신 여기서 화면 문구를 정한다. labelOf 에서 이 맵이 headline 보다 먼저다 —
// 뒤집으면 정본 자유 텍스트로 개인 도메인·플랫폼 실명이 새고 verify-gates.py M2 가 빨개진다
const ANONYMOUS_LABELS = {
  'cafe24-playbook': '잘못된 번호로 결제되는 것을 미리 막고',
  'hyunwoo-dev-admin': '글 쓰고 고치는 화면을 따로 두어',
  'hyunwoo-dev-blog': '오타 하나에 배포까지 돌던 것을 끊고',
  'hyunwoo-dev-monorepo': '사이트 셋이 디자인과 코드를 나눠 쓰게',
  'hyunwoo-dev-web': '무엇을 만들 수 있는지를 화면 자체로',
}

// [찾을 것, 바꿀 것, 왜] — 긴 것부터 적용해야 부분 치환으로 깨지지 않는다. 이유 없는 치환은 넣지 않는다
const REPLACEMENTS = [
  // 개인 스코프 패키지명 — 스택 태그에 실려 개인 사이트를 식별시킨다
  [/\s*[—-]\s*@hyunwoo\/[\w-]+/g, '', '개인 스코프 패키지명 — 설명 꼬리째 뗀다'],
  [/@hyunwoo\/[\w-]+/g, '자체 공통 패키지', '남은 단독 언급'],
  [/카페24|Cafe24|CAFE24/g, '커머스 플랫폼', '플랫폼 실명 비노출'],
  // 루프백 주소는 "외부로 열지 않았다"는 설계 판단이라 표현으로 바꾼다
  // "전용 바인딩" 이 이미 붙은 경우를 먼저 처리한다 — 안 그러면 "로컬 전용 바인딩 전용 바인딩" 이 된다
  [/`?127\.0\.0\.1`?\s*전용 바인딩/g, '로컬 전용 바인딩', '중복 방지'],
  [/`?localhost`?\s*전용 바인딩/g, '로컬 전용 바인딩', '중복 방지'],
  [/`?127\.0\.0\.1`?/g, '로컬 전용 바인딩', '루프백 주소 → 설계 표현'],
  [/`?localhost`?(:\d+)?/g, '로컬 전용 바인딩', '동상'],
  [new RegExp(PERSONAL_DOMAIN.replace('.', '\\.'), 'g'), '개인 기술 사이트', '개인 도메인 비노출'],
]

export function sanitizeString(text) {
  let out = text
  for (const [find, replace] of REPLACEMENTS) out = out.replace(find, replace)
  return out
}

// 키는 건드리지 않는다
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

export function anonymousLabelFor(id) {
  return ANONYMOUS_LABELS[id]
}
