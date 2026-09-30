// 공개 검사 — 생성된 데이터가 공개되면 안 되는 것을 담고 있는지 본다. 뮤테이션 검증을 위해 순수 함수만 두고 I/O 는 호출부가 한다.
// 각 검사에 일부러 통과시키는 것과 그 이유를 함께 적는다 — 사유가 없으면 다음 사람이 허용목록을 지운다

// 이슈키 오탐 허용목록 — 트래커 키가 아니라 기술 용어
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

// 표준 규격 접두사 — 뒤의 숫자는 규격 번호다(ERC-721 등)
// 번들에 들어가도 되는 공개 SDK 호스트. 늘릴 때는 그 경로가 벤더 공개 문서에 있는지 확인한다
const PUBLIC_SDK_HOSTS = ['challenges.cloudflare.com/turnstile']

const ISSUE_KEY_ALLOW_PREFIX = ['ERC', 'EIP', 'BIP', 'RFC', 'CVE', 'ISO', 'IEEE', 'ANSI', 'PEP']

// 표현 제약어 — 다른 항목의 서술에 섞여 들어오는 것까지 막으려 전 데이터에 건다
const FORBIDDEN_WORDS = ['매크로', '자동 예매', '예매 봇', '티켓팅', '크롤링 우회', '자동화 대행']

// 금지 대상은 이력서 PDF 생성의 구현이지 실적 서술이 아니다 — 데이터는 통과시키고 소스의 의존성 유입을 잡는다
const PDF_GENERATION_DEPS = [
  '@react-pdf/renderer',
  'pdfkit',
  'jspdf',
  'html2pdf',
  'puppeteer',
  'playwright-chromium',
]

// 상태 전이표 시각화 금지 — 표의 값을 옮기면 걸린다
const TRANSITION_TABLE_MARKERS = [
  'ALLOWED_TRANSITIONS',
  'ALLOWED_ACTORS',
  'allowedTransitions',
  'allowedActors',
]

// 10/8 · 172.16-31/12 · 192.168/16 · 127/8. 버전 문자열과 겹치지 않게 옥텟 범위를 실제로 검사한다
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

// \b 는 한글 앞에서 안 걸린다(MSF-450에서) — 경계를 직접 준다
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

// 경력 요약 층 건의 원본 저장소명
const SUMMARY_ONLY_IDS = new Set([
  'payment-gateway-api',
  'flow-logistics-frontend',
  'past-satellite-saas',
  'past-backoffice-ds',
  'cafe24-playbook',
  'game-crawler',
])

// 사례 상세 층의 원본 저장소명 — 하이픈 형태는 개인도메인 검사가 못 잡는다. publicIdFor 배선이 끊기면 여기서 잡힌다
const DETAIL_PRIVATE_IDS = new Set([
  'hyunwoo-dev-admin',
  'hyunwoo-dev-blog',
  'hyunwoo-dev-monorepo',
  'hyunwoo-dev-web',
])

const CHECKS = [
  ['사설IP', findPrivateIps],
  // RFC 2606 문서용 example 도메인만 뺀다(placeholder). TLD 는 알파벳 + 오른쪽 경계 — pnpm 경로(next@16.3.4_) 오탐 방지
  // 서브도메인 그룹을 둬야 2단계 TLD(co.kr)를 잡는다. 룩어헤드에 . 을 넣지 않는다 — 문장 끝 마침표 붙은 이메일을 통째로 놓친다
  [
    '이메일',
    (t) =>
      [...t.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}(?![\w+-])/g)]
        .map((m) => m[0])
        .filter((a) => !/@example\.(com|org|net)$|@(example|test|invalid|localhost)$/i.test(a))
        // 사업용 공개 주소 — apps/web/src/shared/lib/company.ts 와 같다
        .filter((a) => a.toLowerCase() !== 'hello@iutzip.dev'),
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
  // 개인 사이트 도메인은 문자열 상수로 남기지 않고 조각으로 조립한다
  ['개인도메인', (t) => (t.includes(['hyunwoo', 'dev'].join('.')) ? ['<개인 도메인>'] : [])],
  // 개인 스코프 패키지명 — 도메인 검사로는 안 걸린다
  ['개인스코프', (t) => [...t.matchAll(/@hyunwoo\/[\w-]+/g)].map((m) => m[0])],
  ['플랫폼실명', (t) => ['카페24', 'Cafe24', 'CAFE24'].filter((w) => t.includes(w))],
  // 저장소명 — 화면에 안 그려도 key 로 RSC 페이로드에 실리므로 보이는 텍스트가 아니라 HTML 원문을 검사한다
  ['요약건저장소명', (t) => [...SUMMARY_ONLY_IDS].filter((id) => t.includes(id))],
  ['상세건저장소명', (t) => [...DETAIL_PRIVATE_IDS].filter((id) => t.includes(id))],
  // 하이픈 형태 전반 — 상세건저장소명(정확한 id)과 개인도메인(점 형태) 사이의 빈틈을 막는다
  [
    '개인도메인하이픈',
    (t) => {
      // 왼쪽 경계가 없으면 xhyunwoo-dev 도 잡는다. 대소문자 무시
      const re = new RegExp(`(?<![\\w-])${['hyunwoo', 'dev'].join('-')}(-[\\w-]+)?`, 'gi')
      // 값을 돌려주지 않는다(로그가 곧 유출). 건수를 문자열에 접는다 — 같은 값을 n 개 주면 Set 이 1건으로 줄인다
      const n = [...t.matchAll(re)].length
      return n > 0 ? [`<개인 도메인(하이픈)> ${n}건`] : []
    },
  ],
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
  // 클라이언트 시스템의 API 엔드포인트 경로 — 남의 시스템 구조다
  // 버전 세그먼트(/v1/)를 요구한다 — 없으면 문서·파일 경로가 전부 걸린다. 이 저장소 api 는 버전 세그먼트를 쓰지 않는다
  // 공개 벤더 SDK 주소(호스트 바로 뒤의 경로)만 뺀다 — 남의 시스템이 아니라 누구나 받는 스크립트다
  [
    '클라이언트API경로',
    (t) =>
      [...t.matchAll(/\/v\d+\/[a-zA-Z][\w/-]*/g)]
        .filter((m) => !PUBLIC_SDK_HOSTS.some((h) => t.slice(0, m.index).endsWith(h)))
        .map((m) => m[0]),
  ],
  // 클라이언트 응답 스펙의 키 나열 — 셋 이상만 잡는다(둘짜리는 설명문에 흔해 오탐이 쏟아진다)
  [
    '응답스펙키나열',
    (t) => [...t.matchAll(/\{\s*[a-z][\w]*(?:\s*,\s*[a-z][\w]*){2,}\s*\}/g)].map((m) => m[0]),
  ],
  // 사명 목록은 호출부가 넘긴다 — 이 파일에 사명을 적지 않는다
  ['회사표기', () => []],
  // 구조 검사라 checkTierRules 로 따로 본다
  ['층규칙', () => []],
]

export const CHECK_NAMES = CHECKS.map(([name]) => name)

// 번들 청크용 — minify 코드에서 호스트명·포트·이슈키는 프로퍼티 접근·상수명과 구별이 안 돼 뺀다(내부URL·트래커경로가 덮는다)
// 이메일은 빼지 않는다 — placeholder 가 실주소로 바뀌면 번들에서 잡을 검사가 이것뿐이다
export const BUNDLE_CHECKS = CHECK_NAMES.filter(
  (n) => !['호스트명·포트', '이슈키', '층규칙'].includes(n),
)

// only 에 검사명 배열을 주면 그것만 돌린다(BUNDLE_CHECKS)
export function scanText(text, extraCompanyNames = [], only = null) {
  const findings = []
  for (const [name, find] of CHECKS) {
    if (only && !only.includes(name)) continue
    let hits = find(text)
    if (name === '회사표기' && extraCompanyNames.length > 0) {
      hits = extraCompanyNames.filter((n) => n.length >= 2 && text.includes(n))
    }
    if (hits.length > 0) findings.push({ check: name, hits: [...new Set(hits)] })
  }
  return findings
}

// summary 층에 상세 필드가 들어갔는지 구조로 본다
export function checkTierRules(projects) {
  const DETAIL_ONLY = ['cardBody', 'brief', 'problem', 'decisions', 'metrics', 'role', 'scale']
  const violations = []
  for (const p of projects) {
    if (p.tier !== 'summary') continue
    for (const f of DETAIL_ONLY) {
      if (p[f] !== undefined) violations.push({ id: p.id, field: f })
    }
  }
  return violations
}

// 카드로 그려지는 건에 cardBody 가 있는가 — problem 폴백이 없어 빠지면 조용하고 눈으로도 티가 안 난다
// commissioned 만 본다 — OwnRow 는 본문을 그리지 않는다
export function checkCardBody(projects) {
  const violations = []
  for (const p of projects) {
    if (p.tier !== 'detail' || p.commissioned !== true) continue
    if (typeof p.cardBody === 'string' && p.cardBody.trim()) continue
    violations.push({ id: p.id })
  }
  return violations
}

export function checkNoPdfGeneration(manifestText) {
  return PDF_GENERATION_DEPS.filter((d) => manifestText.includes(d))
}

// 층 배정을 명단으로 못박는다 — 층 판정이 뒤집히면 상세 필드가 그 층에서 정당해 checkTierRules 가 통과시킨다

// 어느 층으로도 실리면 안 되는 id
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

// 게재 컷 이전 건이 실렸는가 — 다른 검사가 우연히 잡는 것에 기대지 않고 따로 못박는다
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

export function checkMetricEvidence(projects) {
  const bad = []
  for (const p of projects) {
    for (const m of p.metrics ?? []) {
      if (!m.재현 || String(m.재현).trim() === '') bad.push({ id: p.id, 항목: m.항목 })
    }
    for (const line of p.brief?.metrics ?? []) {
      if (!briefMetricBacked(line, p.metrics)) bad.push({ id: p.id, 항목: `brief: ${line}` })
    }
  }
  return bad
}

// 지표 한 줄의 숫자가 전부 재현 명령 있는 지표의 항목·값 안에 있는가(천 단위 쉼표 무시). briefOf 와 이 검사가 같은 판정을 쓴다
export function briefMetricBacked(line, metrics) {
  const usable = (metrics ?? []).filter((m) => m.재현 && String(m.재현).trim() !== '')
  const text = usable
    .map((m) => `${m.항목 ?? ''} ${m.값 ?? ''}`)
    .join(' ')
    .replaceAll(',', '')
  const nums = (String(line).match(/\d[\d,.]*/g) ?? [])
    .map((n) => n.replaceAll(',', '').replace(/\.$/, ''))
    .filter(Boolean)
  return nums.every((n) => text.includes(n))
}
