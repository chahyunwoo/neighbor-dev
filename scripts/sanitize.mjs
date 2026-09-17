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
/**
 * 공개 URL 에 쓰는 id. **저장소명을 그대로 내보내지 않는다.**
 *
 * 🔴 라벨은 익명화하면서 `id` 는 저장소명 그대로 두고 있었다. 그 id 가
 *    `/work/<id>` 라는 **주소**와 RSC 페이로드에 실려, 화면에는 "개인 기술
 *    사이트" 라고 쓰면서 주소창에는 저장소명이 떴다(실측 2026-09-16:
 *    `/work/hyunwoo-dev-admin` 등 4건 전부 200).
 *
 *    CLAUDE.md 3번: 기존 개인 사이트의 도메인과 저장소 링크를 적지 않는다.
 *    하이픈 형태(`hyunwoo-dev-`)는 도메인(`hyunwoo.dev`)을 그대로 읽히게 한다.
 *
 * ⚠️ 여기 없는 id 는 그대로 쓴다 — 드러낼 것이 없는 이름이다.
 */
const PUBLIC_IDS = {
  'hyunwoo-dev-admin': 'personal-site-admin',
  'hyunwoo-dev-blog': 'personal-blog',
  'hyunwoo-dev-monorepo': 'personal-site-monorepo',
  'hyunwoo-dev-web': 'personal-site-web',
}

/** 공개용 id. 매핑이 없으면 원본을 그대로 쓴다. */
export function publicIdFor(id) {
  return PUBLIC_IDS[id] ?? id
}

/*
 * 익명 라벨 — **이 5건만 정본의 `headline` 을 쓰지 않는다.**
 *
 * 🔴 이유: `labelOf`(build-data.mjs)에서 이 맵이 `headline` 보다 **위**에 있다.
 *    정본이 쓴 자유 텍스트가 이 방어선을 우회하면 개인 사이트 도메인·플랫폼
 *    실명이 라벨로 나갈 길이 생긴다. 우선순위를 뒤집으면 `verify-gates.py` 의
 *    M2 가 그 자리에서 빨개진다.
 *
 * ⚠️ 그래서 이 5건의 화면 문구는 **여기서 정한다.** 정본에 매핑 테이블을 만드는
 *    것이 아니라, 원래도 "정본 표기를 쓸 수 없어서" 사이트가 표기를 정하던 건들이다.
 *    #80 에서 나머지 11건과 톤을 맞췄다 — "무엇을 풀었나", 23자 이내.
 *
 * 기획서 11절이 커머스 건의 표기를 이미 정해뒀다("커머스 플랫폼"). 원본 라벨에는
 * 플랫폼 실명이 들어 있다 — 실측(2026-09-09) 화면에서 발견.
 */
const ANONYMOUS_LABELS = {
  'cafe24-playbook': '잘못된 번호로 결제되는 것을 미리 막고',
  'hyunwoo-dev-admin': '글 쓰고 고치는 화면을 따로 두어',
  'hyunwoo-dev-blog': '오타 하나에 배포까지 돌던 것을 끊고',
  'hyunwoo-dev-monorepo': '사이트 셋이 디자인과 코드를 나눠 쓰게',
  'hyunwoo-dev-web': '무엇을 만들 수 있는지를 화면 자체로',
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
