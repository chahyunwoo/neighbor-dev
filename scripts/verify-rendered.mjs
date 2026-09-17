#!/usr/bin/env node
/**
 * 렌더된 화면을 공개 검사기로 통과시킨다.
 *
 * 🔴 데이터 검사(verify-disclosure)만으로는 부족하다. 컴포넌트가 무엇을 어떻게
 *    화면에 올리는지는 데이터 파일이 아니라 **방문자가 받는 HTML** 에 나타난다.
 *
 * ⚠️ 실측(2026-09-09): 데이터 검사를 통과한 상태에서 화면에 두 가지가 나가 있었다.
 *      · `@hyunwoo/ui` — 개인 스코프 패키지명이 스택 태그에 실렸다
 *      · `카페24` — 플랫폼 실명이 경력 요약 라벨에 실렸다
 *    둘 다 **스크린샷을 눈으로 보고서야** 발견했다. 그 뒤 검사 항목으로 추가했다.
 *    → 검사기를 늘리는 것과 별개로, 화면은 계속 눈으로 본다.
 *
 * 🔴 **HTML 만 보면 안 된다**(#78). 실측 2026-09-17: 검사용 감사 명단이
 *    `'use client'` 인 3D 씬을 통해 **JS 청크**에 실려 내부 식별자 16건이
 *    서빙되고 있었다. HTML 에는 한 글자도 없어서 이 검사기가 초록이었다.
 *    → 아래 `checkBundles()` 가 `.next/static` 아래 `.js` 를 같이 훑는다.
 *
 * 쓰는 법:
 *     pnpm --filter @neighbor/web build
 *     node scripts/verify-rendered.mjs --bundles-only   # 서버 없이 — 디스크만 읽는다
 *
 *     pnpm --filter @neighbor/web start &
 *     node scripts/verify-rendered.mjs                  # 화면 + 번들
 *
 * 🔴 **번들 검사는 서버를 타지 않는다.** 처음엔 화면 루프 뒤에 뒀는데, 서버가
 *    없으면 `fetch failed` 로 죽어 **번들 검사에 도달조차 못 했다.** 디스크만
 *    읽는 검사인데 서버 기동이 전제조건이 돼 있었고, 그래서 `verify-gates.py`
 *    를 단독 실행하면 "게이트가 못 잡음" 으로 보고됐다 — 원인은 서버인데.
 */

import { existsSync, globSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLE_CHECKS, scanText } from './disclosure.mjs'
import { realCompanyNames } from './source.mjs'

const BASE = process.env.WEB_BASE_URL ?? 'http://localhost:3200'

const argv = process.argv.slice(2)
const BUNDLES_ONLY = argv.includes('--bundles-only')
const PAGES_ONLY = argv.includes('--pages-only')
if (BUNDLES_ONLY && PAGES_ONLY) {
  console.error('🔴 --bundles-only 와 --pages-only 를 같이 줄 수 없다.')
  process.exit(2)
}

/*
 * 🔴 사명 목록은 source.mjs 가 만든다 — 정본을 못 찾으면 거기서 throw 한다.
 *
 *    실측 2026-09-16: 이 파일은 경로를 직접 박아 두고(`~/Documents/...`,
 *    환경변수도 안 받았다) 없으면 `return []` 로 넘어갔다. 정본이 옮겨진 뒤로
 *    **사명 유출 검사가 아무것도 하지 않으면서 초록을 내고 있었다.**
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(ROOT, 'data/generated/projects.json'), 'utf8'))
const paths = [
  '/',
  '/work',
  '/stack',
  '/career',
  '/contact',
  '/diagnose',
  ...data.detail.map((p) => `/work/${p.id}`),
]

const companies = realCompanyNames()

/**
 * dev 서버에 대고 돌면 **멈춘다.**
 *
 * 🔴 `next dev` 는 HTML 에 `node_modules` 경로를 그대로 싣는다. 그 경로가
 *    이메일 정규식에 걸려 **16개 화면 전부가 빨갛게** 나왔다(이슈 #32):
 *
 *        🔴 /
 *             이메일: next@16.3.4_, types+node@26.5.0_react, -dom@19.2.8_react
 *
 *    prod 빌드에서는 같은 검사가 통과한다. 즉 **전부 오탐**이다.
 *
 * 🔴 **오탐을 걸러내는 쪽으로 고치지 않는다.** 이메일 정규식에 예외를 파면
 *    진짜 이메일을 놓칠 길이 같이 생긴다. 공개 검사기가 내는 빨강은 심각도가
 *    높아서, 오탐이 섞이면 진짜 유출과 구별이 안 되고 결국 사람이 이 검사기를
 *    안 믿게 된다 — **그게 제일 나쁜 결말이다.**
 *    → 잘못된 대상에 돌리고 있다는 것을 **그 자리에서 말하고 멈춘다.**
 */
function assertProd(html) {
  // dev 에만 나오는 두 가지. 둘 다 prod 빌드에는 0건이다(실측 2026-09-17).
  const devMark = html.includes('next-devtools') || html.includes('/node_modules/')
  if (!devMark) return
  console.error(`🔴 ${BASE} 는 dev 서버다. 이 검사는 **prod 빌드**에 대고 돌린다.`)
  console.error('')
  console.error('   dev 는 HTML 에 node_modules 경로를 싣고, 그것이 이메일 검사에 걸려')
  console.error('   모든 화면이 오탐으로 빨개진다(이슈 #32). 결과를 믿을 수 없다.')
  console.error('')
  console.error('   pnpm --filter @neighbor/web build')
  console.error('   pnpm --filter @neighbor/web start &')
  console.error('   node scripts/verify-rendered.mjs')
  process.exit(2)
}

let bad = 0
let checkedProd = false
for (const p of PAGES_ONLY || !BUNDLES_ONLY ? paths : []) {
  const html = await fetch(BASE + p).then((r) => r.text())
  if (!checkedProd) {
    assertProd(html)
    checkedProd = true
  }
  const findings = scanText(html, companies)
  if (findings.length) {
    bad++
    console.log(`🔴 ${p}`)
    for (const f of findings) {
      const shown = f.check === '회사표기' ? [`${f.hits.length}건`] : f.hits.slice(0, 4)
      console.log(`     ${f.check}: ${shown.join(', ')}`)
    }
  }
}
/*
 * 빌드된 JS 청크 검사 — **HTML 에 안 나와도 방문자는 받는다.**
 *
 * 두 가지를 본다:
 *   (1) 공개 id 가 **아닌** 내부 식별자가 번들에 있는가 — #78 을 그대로 막는다.
 *       `data/audit.json` 의 정본 id 와 게재 id 를 대조하므로 오탐이 0 이다.
 *   (2) 공개 검사기(BUNDLE_CHECKS) — 사명·도메인·시크릿 등.
 *
 * ⚠️ 디스크의 빌드 산출물을 읽는다. HTTP 로 받지 않는 이유: 청크는 HTML 에서
 *    직접 참조되지 않고 런타임이 조립해 부르는 것이 있어서, **URL 을 모아
 *    받는 방식은 빠뜨린다.** 실제로 #78 의 청크가 그랬다(HTML 참조 0회, HTTP 200).
 */
function checkBundles() {
  /*
   * 🔴 **원격을 가리킨 채로는 돌지 않는다.** 이 검사는 로컬 디스크의
   *    `apps/web/.next/static` 을 읽는다. `배포.md` 는 `WEB_BASE_URL` 로
   *    배포처를 가리켜 이 스크립트를 돌리라고 적어놨는데, 그러면 **화면은
   *    배포처를 보고 번들은 내 맥을 본다.** 로컬 빌드가 다른 브랜치거나
   *    낡았어도 `✅ 번들 전부 통과` 가 찍힌다 — 검사기가 아예 다른 것을
   *    보고 있는, 제일 나쁜 형태다.
   *    → 조용히 넘어가지 않고 그 자리에서 말하고 멈춘다.
   */
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE)
  if (!isLocal) {
    console.error(`🔴 WEB_BASE_URL 이 원격이다: ${BASE}`)
    console.error('')
    console.error('   번들 검사는 로컬 디스크(apps/web/.next/static)를 읽는다.')
    console.error('   원격 배포본과 무관한 것을 훑고 초록을 낼 수 있어 거부한다.')
    console.error('')
    console.error('   배포처 점검은 화면만:  node scripts/verify-rendered.mjs --pages-only')
    console.error('   번들은 배포할 빌드에서: node scripts/verify-rendered.mjs --bundles-only')
    process.exit(2)
  }

  const dir = join(ROOT, 'apps/web/.next/static')
  if (!existsSync(dir)) {
    console.error(`🔴 빌드 산출물이 없다: ${dir}`)
    console.error('   prod 빌드를 먼저 한다 — pnpm --filter @neighbor/web build')
    process.exit(2)
  }
  /*
   * 🔴 `.js` 만 보지 않는다. 무엇이 "번들" 인지를 정하는 유일한 지점이라
   *    여기서 빠지면 그 확장자는 **아무도 안 본다.**
   *    실측 2026-09-17 산출물: js 20 · css 4. CSS 도 `content:"…"`·`url(…)`·
   *    주석을 실어 나르고, 소스맵을 켜면 `.map` 이 원본 주석째로 나간다.
   */
  const files = globSync(join(dir, '**/*.{js,css,map,mjs,cjs}'))
  if (files.length === 0) {
    console.error(`🔴 ${dir} 에 검사할 파일이 0개다. 검사가 아무것도 안 보고 초록을 낼 뻔했다.`)
    process.exit(2)
  }

  // (1) 내부 식별자 — 공개 id 목록에 없는 것만 위반이다.
  const auditPath = join(ROOT, 'data/audit.json')
  if (!existsSync(auditPath)) {
    console.error(`🔴 감사 명단이 없다: ${auditPath} — 먼저 \`pnpm data\` 를 돌린다.`)
    process.exit(2)
  }
  const audit = JSON.parse(readFileSync(auditPath, 'utf8'))
  /*
   * 🔴 **빈 명단으로 초록을 내지 않는다.** `audit` 가 `[]` 면 대조가 영원히
   *    0건인데 출력은 "내부식별자 대조" 라고 말한다 — 정상과 계측 실패가
   *    같은 모양이 된다. 0 은 "없다" 가 아니라 "못 읽었다" 일 수 있다.
   */
  if (audit.length === 0) {
    console.error(`🔴 감사 명단이 비었다: ${auditPath} — 대조가 no-op 이 된다.`)
    process.exit(2)
  }
  const publicIds = new Set(data.detail.map((p) => p.id))

  let n = 0
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    const name = f.slice(dir.length + 1)

    const leaked = audit.map((a) => a.id).filter((id) => !publicIds.has(id) && text.includes(id))
    const findings = scanText(text, companies, BUNDLE_CHECKS)
    if (leaked.length === 0 && findings.length === 0) continue

    n++
    console.log(`🔴 번들 ${name}`)
    // 값을 찍지 않는다 — 출력 자체가 유출이고, 이 로그는 CI 에도 남는다.
    if (leaked.length) console.log(`     내부식별자: ${leaked.length}건`)
    for (const fd of findings) console.log(`     ${fd.check}: ${fd.hits.length}건`)
  }
  console.log(
    n === 0
      ? `✅ 번들 ${files.length}개 전부 통과 (검사 ${BUNDLE_CHECKS.length}종 + 내부식별자 대조)`
      : `🔴 번들 ${n}/${files.length} 개에서 위반`,
  )
  return n
}

/*
 * 🔴 **안 돌린 것을 통과했다고 말하지 않는다.** `--bundles-only` 인데
 *    "화면 16개 전부 통과" 를 찍으면, 로그만 보는 다음 사람이 화면도
 *    검사된 줄 안다. 안 본 것은 "건너뜀" 이라고 적는다.
 */
const badBundles = PAGES_ONLY ? 0 : checkBundles()
if (PAGES_ONLY) console.log('⏭  번들 검사 건너뜀 (--pages-only)')

if (BUNDLES_ONLY) {
  console.log(`⏭  화면 검사 건너뜀 (--bundles-only · 대상 ${paths.length}개)`)
} else {
  console.log(
    bad === 0
      ? `✅ 렌더된 ${paths.length}개 화면 전부 통과`
      : `🔴 ${bad}/${paths.length} 화면에서 위반`,
  )
}
process.exit(bad === 0 && badBundles === 0 ? 0 : 1)
