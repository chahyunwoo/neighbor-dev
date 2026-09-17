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

/** 검사 17항목. 각각 (이름, 찾는 함수). */
const SUMMARY_ONLY_IDS = new Set([
  'payment-gateway-api',
  'flow-logistics-frontend',
  'past-satellite-saas',
  'past-backoffice-ds',
  'cafe24-playbook',
  'game-crawler',
])

/**
 * 공개하면 안 되는 **사례 상세 층**의 원본 저장소명.
 *
 * 🔴 위 `SUMMARY_ONLY_IDS` 는 경력 요약 6건만 봤다. 그런데 사례 상세 4건의
 *    `id` 도 저장소명 그대로였고, 그게 `/work/<id>` 라는 **주소**로 나갔다
 *    (실측 2026-09-16: `/work/hyunwoo-dev-admin` 등 전부 200).
 *    같은 파일 안에서 한쪽만 막고 다른 쪽을 남긴 형태다.
 *
 * ⚠️ 점 형태(`hyunwoo.dev`)는 `개인도메인` 검사가 잡지만 **하이픈 형태는 못 잡는다.**
 *    `publicIdFor`(sanitize.mjs)가 슬러그로 바꾸고, 이 검사가 그 배선이 끊기면 잡는다.
 */
const DETAIL_PRIVATE_IDS = new Set([
  'hyunwoo-dev-admin',
  'hyunwoo-dev-blog',
  'hyunwoo-dev-monorepo',
  'hyunwoo-dev-web',
])

const CHECKS = [
  ['사설IP', findPrivateIps],
  /*
   * 이메일. ⚠️ RFC 2606 이 문서용으로 못박은 도메인은 뺀다 — placeholder 의
   *    `you@example.com` 이 유출로 잡혔다(실측 2026-09-09). 그 도메인들은
   *    누구에게도 도달하지 않으므로 연락처가 아니다.
   *    **example 이 붙은 것만** 뺀다. 다른 실제 도메인은 그대로 잡는다.
   *
   * 🔴 **TLD 는 알파벳이고 오른쪽 경계가 있다.** 전에는 `\.[\w.]{2,}` 라
   *    `next@16.3.4_` 같은 pnpm 경로를 이메일로 잡았다(번들 실측 4건).
   *    ⚠️ 경계만 조이면 `hong@client.co.kr` 을 **놓친다** — 2단계 TLD 가
   *    진짜 유출 시나리오다. 서브도메인 그룹을 함께 둬야 한다.
   *
   * 🔴 **룩어헤드에 `.` 을 넣지 않는다.** 한 번 넣었다가 회귀를 만들었다:
   *    `(?![\w.+-])` 로 쓰면 `문의는 hong@client.co.kr.` 처럼 **문장 끝
   *    마침표가 붙은 이메일을 통째로 못 잡는다**(짧게 끊는 게 아니라 0건).
   *    한국어 문장은 마침표로 끝나므로 실제 경로다. `.` 을 빼도 pnpm 경로는
   *    여전히 안 잡힌다 — TLD 를 알파벳으로 못박은 쪽이 일을 하기 때문이다.
   *    실측 2026-09-17: 진짜 이메일 5/5(마침표·하이픈 뒤따름 포함) ·
   *    pnpm 경로 5종 0/5 · 번들 24개에서 새 오탐 0건.
   */
  [
    '이메일',
    (t) =>
      [...t.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}(?![\w+-])/g)]
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
  ['상세건저장소명', (t) => [...DETAIL_PRIVATE_IDS].filter((id) => t.includes(id))],
  /*
   * 하이픈 형태 **전반**. 위 `상세건저장소명` 은 정확한 id 4개만, `개인도메인` 은
   * 점 형태만 본다 — 그 사이가 비어 있다. `hyunwoo-dev 블로그` 나
   * `hyunwoo-dev-newthing` 처럼 쓰면 **둘 다 통과한다.**
   *
   * ⚠️ 위양성 0건을 확인하고 넣었다(실측 2026-09-17): 게재분·렌더 HTML·번들 청크
   *    전부 0건. 정본에는 37군데 있지만 그건 산출물로 안 나가는 작업 노트다.
   */
  [
    '개인도메인하이픈',
    (t) => {
      // 왼쪽 경계를 준다 — 없으면 `xhyunwoo-dev` 도 잡는다. 대소문자는 무시한다.
      const re = new RegExp(`(?<![\\w-])${['hyunwoo', 'dev'].join('-')}(-[\\w-]+)?`, 'gi')
      /*
       * 🔴 **값을 돌려주지 않는다.** 호출부가 hits 를 그대로 출력하므로
       *    걸리는 날 로그에 개인 도메인이 찍힌다 — 그 로그가 곧 유출이다.
       *    바로 위 `개인도메인` 이 플레이스홀더를 쓰는 것과 같은 이유다.
       *
       * ⚠️ **건수를 문자열 안에 접는다.** 같은 플레이스홀더를 n 개 돌려주면
       *    `scanText` 의 `[...new Set(hits)]` 가 중복을 지워 **몇 건이 걸려도
       *    항상 1건**으로 보고된다(실측). 게이트는 빨개지지만 범위를 못 읽는다.
       */
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
  // 회사 표기: 사명을 익명화했는지. 원본 `client` 필드 값이 그대로 새어나오면 걸린다.
  // (호출부가 원본 사명 목록을 넘긴다 — 이 파일에 사명을 적지 않는다.)
  ['회사표기', () => []],
  // 층 규칙 위반은 구조 검사라 별도 함수로 둔다(아래 checkTierRules).
  ['층규칙', () => []],
]

export const CHECK_NAMES = CHECKS.map(([name]) => name)

/*
 * 빌드된 JS 청크에 돌릴 검사 목록.
 *
 * 🔴 **전부 돌리면 못 쓴다.** minify 된 코드에서 오탐이 쏟아진다 —
 *    실측 2026-09-17: `a.internal`·`n.internal`(프로퍼티 접근) 7건,
 *    `RGB-0`·`PI-1`(상수명) 2건, `next@16.3.4_`(pnpm 경로) 4건.
 *
 * 🔴 **이메일은 빼지 않는다.** 처음엔 뺐는데, 오탐 4건이 전부 정규식이 느슨해서
 *    생긴 것이었다(TLD 자리에 숫자·언더스코어를 허용했다). 정규식을 정확하게
 *    고치니 오탐이 0 이 됐다 — **검사를 빼는 대신 검사를 맞게 고치는 쪽**이다.
 *    번들에서 이메일만 잡을 수 있는 경로가 실제로 있다: 문의 폼의 placeholder
 *    (`entities/contact`)가 클라이언트 번들에 실리고, 그게 언젠가 실주소로
 *    바뀌면 나머지 검사는 **하나도 안 잡는다**(`내부URL`·`트래커경로` 는
 *    스킴·경로 형태만 본다).
 *
 * ⚠️ 남은 둘(`호스트명·포트`·`이슈키`)은 minify 코드의 프로퍼티 접근·상수명과
 *    구조적으로 구별이 안 된다. 다만 스킴 붙은 내부 호스트는 `내부URL` 이,
 *    경로형 이슈키는 `트래커경로` 가 덮는다. `층규칙` 은 구조 검사라 텍스트에 안 건다.
 */
export const BUNDLE_CHECKS = CHECK_NAMES.filter(
  (n) => !['호스트명·포트', '이슈키', '층규칙'].includes(n),
)

/**
 * 텍스트 검사를 돌린다. `extraCompanyNames` 가 오면 회사표기 검사에 쓴다.
 * `only` 에 검사명 배열을 주면 그것만 돌린다(번들 청크용 — BUNDLE_CHECKS 참고).
 * @returns {{check: string, hits: string[]}[]} 걸린 것만
 */
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

/**
 * 층 규칙 검사 — summary 층에 상세 필드가 들어갔는지 본다.
 * 지난 세션의 사고가 정확히 이것이므로 구조로 검사한다.
 */
export function checkTierRules(projects) {
  const DETAIL_ONLY = ['cardBody', 'problem', 'decisions', 'metrics', 'role', 'scale']
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
