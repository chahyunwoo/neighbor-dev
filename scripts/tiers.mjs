// 층 규칙 — 판정은 이 파일 한 곳에서만 한다. 호출부가 clientSafe 를 직접 보고 분기하지 않는다

// 게재 컷 — 이 시점 이후만 싣는다
export const CUTOFF = { year: 2025, month: 4 }

// 상시 공개 페이지에 싣지 않는 항목
export const EXCLUDED_IDS = new Set(['discord-bot'])

export const TIER = {
  /** clientSafe:true — 문제·판단·수치·화면까지 */
  DETAIL: 'detail',
  /** clientSafe:false — 도메인 + 기간 + 스택까지만 */
  SUMMARY: 'summary',
  NONE: 'none',
}

// 못 읽으면 null — 추측하지 않는다
export function parsePeriodStart(period) {
  const m = /^(\d{4})\.(\d{2})/.exec(String(period ?? ''))
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) }
}

function isAfterCutoff(start) {
  if (!start) return false
  if (start.year !== CUTOFF.year) return start.year > CUTOFF.year
  return start.month >= CUTOFF.month
}

export function tierOf(project) {
  if (EXCLUDED_IDS.has(project.id)) return TIER.NONE
  if (!isAfterCutoff(parsePeriodStart(project.period))) return TIER.NONE
  return project.clientSafe === true ? TIER.DETAIL : TIER.SUMMARY
}

// 허용목록 — 여기에 없는 필드는 나가지 않는다(원본에 새 필드가 생겨도 조용히 새지 않는다)
export const ALLOWED_FIELDS = {
  [TIER.DETAIL]: [
    'id',
    'tier',
    'label',
    'period',
    'domain',
    'commissioned',
    'stack',
    'role',
    // 사례 상세 층에만 나가는 카드 본문 한 문장
    'cardBody',
    // 상세 화면 맨 앞의 요약(한 줄 + 불릿)
    'brief',
    'problem',
    'decisions',
    'metrics',
    'scale',
  ],
  // 경력 요약에는 id(저장소명)를 내보내지 않는다 — 저장소명이 클라이언트를 드러내고, 화면에 안 그려도 key 로 RSC 페이로드에 실린다
  [TIER.SUMMARY]: ['tier', 'label', 'period', 'domain', 'stack', 'commissioned'],
}
