/**
 * 층 규칙 — 기획서 11절. 한 곳에서만 판정한다.
 *
 * 지난 세션에 clientSafe:false 3건에 문제·판단·수치를 실어 공개한 사고가 있었다.
 * 공개 저장소·상시 공개라 회수가 안 된다. 그래서 판정을 한 곳으로 모으고,
 * 호출부가 조건을 풀어 쓰지 못하게 한다(전역 규칙 7절).
 */

/** 게재 컷 — 이 시점 이후만 싣는다 (기획서 3절). */
export const CUTOFF = { year: 2025, month: 4 }

/** 채널 제외 — 상시 공개 페이지에는 싣지 않는다 (기획서 11절). */
export const EXCLUDED_IDS = new Set(['discord-bot'])

/** 층 이름. */
export const TIER = {
  /** clientSafe:true — 문제·판단·수치·화면까지. */
  DETAIL: 'detail',
  /** clientSafe:false — 도메인 + 기간 + 스택까지만. */
  SUMMARY: 'summary',
  /** 싣지 않는다. */
  NONE: 'none',
}

/** `"2025.11 ~ ..."` 에서 (연, 월)을 뽑는다. 못 읽으면 null — 추측하지 않는다. */
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

/**
 * 이 항목이 어느 층인가. **판정은 여기 하나뿐이다.**
 * 호출부에서 `clientSafe` 를 직접 보고 분기하지 않는다.
 */
export function tierOf(project) {
  if (EXCLUDED_IDS.has(project.id)) return TIER.NONE
  if (!isAfterCutoff(parsePeriodStart(project.period))) return TIER.NONE
  return project.clientSafe === true ? TIER.DETAIL : TIER.SUMMARY
}

/**
 * 각 층에서 내보내도 되는 필드. 여기에 없는 필드는 나가지 않는다.
 * (허용목록 방식 — 새 필드가 원본에 생겨도 조용히 새어나가지 않는다.)
 */
export const ALLOWED_FIELDS = {
  [TIER.DETAIL]: [
    'id',
    'tier',
    'label',
    'period',
    'domain',
    'stack',
    'role',
    'problem',
    'decisions',
    'metrics',
    'scale',
  ],
  /*
   * 🔴 **경력 요약에는 `id` 를 내보내지 않는다.**
   *
   *    `id` 는 정본의 **저장소명**이다(`cafe24-playbook`, `payment-gateway-api`,
   *    `flow-logistics-frontend` …). 저장소명 자체가 클라이언트·플랫폼·도메인을
   *    드러내는 건이 많고, 이 층은 정확히 그걸 감추려고 만든 층이다.
   *
   *    ⚠️ 화면에 안 그려도 새어나간다 — React 의 `key={p.id}` 가 **RSC 페이로드로
   *       직렬화되어 HTML 에 그대로 실린다**(실측 2026-09-09: `/career`·`/work`
   *       서버 HTML 에 `cafe24`·`payment-gateway`·`flow-logistics` 등 6개가
   *       나가 있었다). 눈에는 안 보이지만 크롤러와 페이지 소스에는 보인다.
   *       `verify-rendered.mjs` 는 보이는 텍스트만 봐서 못 잡았다.
   *
   *    → 목록 key 가 필요하면 `label+period` 처럼 **드러내지 않는 값**을 쓴다.
   *    (사례 상세 10건은 `clientSafe:true` 이고 URL 이 필요해서 `id` 를 남긴다.)
   */
  [TIER.SUMMARY]: ['tier', 'label', 'period', 'domain', 'stack'],
}
