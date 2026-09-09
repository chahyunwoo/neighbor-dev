/**
 * 공개 검사 — 생성된 데이터가 공개되면 안 되는 것을 담고 있는지 본다.
 *
 * 순수 함수만 둔다. 파일 I/O 는 호출부(verify-disclosure.mjs)가 한다 —
 * 그래야 검사기 자체를 뮤테이션으로 검증할 수 있다.
 *
 * ⚠️ 각 검사는 "무엇을 잡는가"와 "무엇을 일부러 통과시키는가"를 함께 적는다.
 *    통과 사유가 적혀 있지 않으면 다음 사람이 허용목록을 지운다.
 */

/** 이슈키 오탐을 막는 허용목록 — 기술 용어이지 트래커 키가 아니다. */
const ISSUE_KEY_ALLOW = new Set([
  'AES-256',
  'AES-128',
  'SHA-256',
  'SHA-512',
  'SHA-1',
  'RSA-2048',
  'RSA-4096',
  'UTF-8',
  'UTF-16',
  'ISO-8601',
  'RFC-6238',
  'RFC-7519',
  'HS-256',
  'ES-256',
  'HTTP-2',
  'TLS-1',
  'CVE-2021',
  'CVE-2022',
  'CVE-2023',
  'CVE-2024',
  'OWASP-10',
  'P-256',
  'CC-BY',
  'CC-0',
])

/**
 * 표준 규격 접두사 — 뒤에 숫자가 붙는 것이 규격 번호이지 트래커 키가 아니다.
 * ⚠️ 실측(뮤테이션 M7): `ERC-721` 이 이슈키로 오탐됐다.
 */
const ISSUE_KEY_ALLOW_PREFIX = ['ERC', 'EIP', 'BIP', 'RFC', 'CVE', 'ISO', 'IEEE', 'ANSI', 'PEP']

/**
 * 표현 제약어 (전역 규칙). 해당 도메인은 기술 과제 중심으로만 서술한다.
 * 이 저장소는 애초에 discord-bot 을 제외하지만, 다른 항목의 서술에
 * 섞여 들어오는 것을 막기 위해 전 데이터에 건다.
 */
const FORBIDDEN_WORDS = ['매크로', '자동 예매', '예매 봇', '티켓팅', '크롤링 우회', '자동화 대행']

/**
 * 이력서 PDF 생성 기능을 **이 사이트에 구현하지 않는다** (CLAUDE.md 4번).
 * 실명·연락처가 들어가기 때문이다.
 *
 * ⚠️ 금지 대상은 *구현*이지 *실적 서술*이 아니다. "과거에 그런 걸 만들었다"는
 *    실적이므로 데이터에서는 통과시키고, **소스 코드에서 PDF 생성 의존성이
 *    들어오는 것**을 잡는다(checkNoPdfGeneration). 2026-09-09 사용자 확정.
 */
const PDF_GENERATION_DEPS = [
  '@react-pdf/renderer',
  'pdfkit',
  'jspdf',
  'html2pdf',
  'puppeteer',
  'playwright-chromium',
]

/** 상태 전이표 시각화 금지 (기획서·CLAUDE.md). 표의 값을 옮기면 걸린다. */
const TRANSITION_TABLE_MARKERS = [
  'ALLOWED_TRANSITIONS',
  'ALLOWED_ACTORS',
  'allowedTransitions',
  'allowedActors',
]

/**
 * 사설 IP. 10/8 · 172.16-31/12 · 192.168/16 · 127/8.
 * ⚠️ 버전 문자열(`1.2.3.4` 같은 4자리)과 겹치지 않게 옥텟 범위를 실제로 검사한다.
 */
function findPrivateIps(text) {
  const hits = []
  const re = /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g
  for (const m of text.matchAll(re)) {
    const o = [m[1], m[2], m[3], m[4]].map(Number)
    if (o.some((n) => n > 255)) continue
    const isPrivate =
      o[0] === 10 ||
      o[0] === 127 ||
      (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
      (o[0] === 192 && o[1] === 168)
    if (isPrivate) hits.push(m[0])
  }
  return hits
}

/**
 * 이슈키 `[A-Z]{2,5}-\d+`.
 * ⚠️ `\b` 는 한글 앞에서 안 걸린다 — `MSF-450에서` 를 놓친다(실측).
 *    그래서 경계를 `(?<![A-Za-z0-9])` / `(?![0-9])` 로 직접 준다.
 */
function findIssueKeys(text) {
  const re = /(?<![A-Za-z0-9])([A-Z]{2,5})-(\d+)(?![0-9])/g
  const hits = []
  for (const m of text.matchAll(re)) {
    if (ISSUE_KEY_ALLOW.has(m[0])) continue
    if (ISSUE_KEY_ALLOW_PREFIX.includes(m[1])) continue
    hits.push(m[0])
  }
  return hits
}

/** 검사 12항목. 각각 (이름, 찾는 함수). */
const SUMMARY_ONLY_IDS = new Set([
  'payment-gateway-api',
  'flow-logistics-frontend',
  'past-satellite-saas',
  'past-backoffice-ds',
  'cafe24-playbook',
  'game-crawler',
])

const CHECKS = [
  ['사설IP', findPrivateIps],
  // 이메일. ⚠️ RFC 2606 이 문서용으로 못박은 도메인은 뺀다 — placeholder 의
  //    `you@example.com` 이 유출로 잡혔다(실측 2026-09-09). 그 도메인들은
  //    누구에게도 도달하지 않으므로 연락처가 아니다.
  //    **example 이 붙은 것만** 뺀다. 다른 실제 도메인은 그대로 잡는다.
  [
    '이메일',
    (t) =>
      [...t.matchAll(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g)]
        .map((m) => m[0])
        .filter((a) => !/@example\.(com|org|net)$|@(example|test|invalid|localhost)$/i.test(a)),
  ],
  [
    '내부URL',
    (t) =>
      [...t.matchAll(/https?:\/\/(localhost|127\.0\.0\.1|[\w-]+\.(local|internal|lan))\S*/gi)].map(
        (m) => m[0],
      ),
  ],
  [
    '토큰·시크릿',
    (t) =>
      [
        ...t.matchAll(
          /\b(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|test_sk_[A-Za-z0-9]{10,}|live_sk_[A-Za-z0-9]{10,})\b/g,
        ),
      ].map((m) => m[0]),
  ],
  ['표현제약어', (t) => FORBIDDEN_WORDS.filter((w) => t.includes(w))],
  // 개인 사이트 도메인 — CLAUDE.md 가 이 파일에 도메인 자체를 쓰지 말라 하므로
  // 조각으로 조립해 문자열 상수로 남기지 않는다.
  ['개인도메인', (t) => (t.includes(['hyunwoo', 'dev'].join('.')) ? ['<개인 도메인>'] : [])],
  // 개인 스코프 패키지명 — 도메인이 아니라 npm 스코프로 새어나온다.
  // ⚠️ 실측(2026-09-09): `@hyunwoo/ui` 가 스택 태그에 실려 화면에 나갔는데
  //    도메인 검사(`hyunwoo.dev`)로는 안 걸렸다. 눈으로 보고서야 잡혔다.
  ['개인스코프', (t) => [...t.matchAll(/@hyunwoo\/[\w-]+/g)].map((m) => m[0])],
  // 플랫폼·서비스 실명 (기획서 11절이 익명 표기를 정한 건).
  ['플랫폼실명', (t) => ['카페24', 'Cafe24', 'CAFE24'].filter((w) => t.includes(w))],
  /*
   * 경력 요약 건의 **저장소명**. `id` 가 곧 정본의 파일명이고, 그 이름이
   * 클라이언트·플랫폼·도메인을 드러낸다(`cafe24-playbook` 등).
   *
   * 🔴 화면에 안 그려도 새어나간다 — React 의 `key={p.id}` 가 **RSC 페이로드로
   *    직렬화되어 HTML 에 실린다.** 실측 2026-09-09: `/career`·`/work` 의 서버
   *    HTML 에 6개가 그대로 나가 있었다(눈에는 안 보이고 페이지 소스에는 보인다).
   *    `플랫폼실명` 검사는 `카페24`·`Cafe24` 만 봐서 소문자 id 를 놓쳤다.
   *    → **보이는 텍스트가 아니라 HTML 원문을 검사한다**(verify-rendered 가 그렇게 한다).
   */
  ['요약건저장소명', (t) => [...SUMMARY_ONLY_IDS].filter((id) => t.includes(id))],
  [
    '호스트명·포트',
    (t) => [...t.matchAll(/\b[\w-]+\.(local|internal|lan|home)\b(:\d+)?/gi)].map((m) => m[0]),
  ],
  ['이슈키', findIssueKeys],
  [
    '트래커경로',
    (t) => [...t.matchAll(/\/(browse|jira|issues)\/[A-Z]{2,5}-\d+/g)].map((m) => m[0]),
  ],
  ['상태전이표', (t) => TRANSITION_TABLE_MARKERS.filter((w) => t.includes(w))],
  // 회사 표기: 사명을 익명화했는지. 원본 `client` 필드 값이 그대로 새어나오면 걸린다.
  // (호출부가 원본 사명 목록을 넘긴다 — 이 파일에 사명을 적지 않는다.)
  ['회사표기', () => []],
  // 층 규칙 위반은 구조 검사라 별도 함수로 둔다(아래 checkTierRules).
  ['층규칙', () => []],
]

export const CHECK_NAMES = CHECKS.map(([name]) => name)

/**
 * 텍스트 검사 10종을 돌린다. `extraCompanyNames` 가 오면 회사표기 검사에 쓴다.
 * @returns {{check: string, hits: string[]}[]} 걸린 것만
 */
export function scanText(text, extraCompanyNames = []) {
  const findings = []
  for (const [name, find] of CHECKS) {
    let hits = find(text)
    if (name === '회사표기' && extraCompanyNames.length > 0) {
      hits = extraCompanyNames.filter((n) => n.length >= 2 && text.includes(n))
    }
    if (hits.length > 0) findings.push({ check: name, hits: [...new Set(hits)] })
  }
  return findings
}

/**
 * 층 규칙 검사 — summary 층에 상세 필드가 들어갔는지 본다.
 * 지난 세션의 사고가 정확히 이것이므로 구조로 검사한다.
 */
export function checkTierRules(projects) {
  const DETAIL_ONLY = ['problem', 'decisions', 'metrics', 'role', 'scale']
  const violations = []
  for (const p of projects) {
    if (p.tier !== 'summary') continue
    for (const f of DETAIL_ONLY) {
      if (p[f] !== undefined) violations.push({ id: p.id, field: f })
    }
  }
  return violations
}

/**
 * 소스 코드에 PDF 생성 의존성이 들어왔는지 본다 (CLAUDE.md 4번).
 * @param {string} manifestText 검사할 package.json 들의 내용을 이은 문자열
 */
export function checkNoPdfGeneration(manifestText) {
  return PDF_GENERATION_DEPS.filter((d) => manifestText.includes(d))
}

/**
 * 층 배정 자체를 검사한다 — `checkTierRules` 로는 안 잡힌다.
 *
 * ⚠️ 실측(뮤테이션 M4): 층 판정을 `TIER.DETAIL` 고정으로 바꿨더니
 *    `payment-gateway-api` 가 상세 층으로 올라갔는데, 그 층에서는 상세 필드가
 *    정당하므로 `checkTierRules` 가 통과시켰다. 다른 검사(이슈키·상태전이표)가
 *    우연히 잡았을 뿐이다 — **명단을 직접 못박아야 한다.**
 *
 * 기획서 11절의 판정 결과를 그대로 옮긴 것이며, 기획서가 바뀌면 여기도 바꾼다.
 */

/** 이 id 들은 어느 층으로도 실리면 안 된다 (기획서 11절 채널 제외). */
const NEVER_PUBLISHED_IDS = new Set(['discord-bot'])

export function checkTierAssignment(projects) {
  const violations = []
  for (const p of projects) {
    if (NEVER_PUBLISHED_IDS.has(p.id)) {
      violations.push({ id: p.id, reason: '게재 제외 대상인데 실렸다' })
      continue
    }
    if (SUMMARY_ONLY_IDS.has(p.id) && p.tier !== 'summary') {
      violations.push({ id: p.id, reason: `경력 요약 층이어야 하는데 '${p.tier}' 로 실렸다` })
    }
  }
  return violations
}

/**
 * 게재 컷 검사 — 2025.04 이전 건이 실리지 않았는가 (기획서 3절).
 *
 * ⚠️ 실측(뮤테이션 M7): 컷 판정을 지웠더니 컷 이전 6건이 실렸는데
 *    다른 검사가 우연히 이슈키 하나만 잡았다. 게재 범위는 별도로 못박는다.
 *    이 6건은 전부 `clientSafe:false` 인 과거 상주 이력이다.
 */
const CUTOFF_YM = 2025 * 100 + 4

export function checkPeriodCutoff(projects) {
  const violations = []
  for (const p of projects) {
    const m = /^(\d{4})\.(\d{2})/.exec(String(p.period ?? ''))
    if (!m) {
      violations.push({ id: p.id, reason: `period 를 읽을 수 없다: ${p.period ?? '(없음)'}` })
      continue
    }
    const ym = Number(m[1]) * 100 + Number(m[2])
    if (ym < CUTOFF_YM) {
      violations.push({ id: p.id, reason: `게재 컷(2025.04) 이전인데 실렸다: ${m[1]}.${m[2]}` })
    }
  }
  return violations
}

/**
 * 재현 명령이 없는 metric 은 실을 수 없다 (기획서 9절).
 */
export function checkMetricEvidence(projects) {
  const bad = []
  for (const p of projects) {
    for (const m of p.metrics ?? []) {
      if (!m.재현 || String(m.재현).trim() === '') bad.push({ id: p.id, 항목: m.항목 })
    }
  }
  return bad
}
