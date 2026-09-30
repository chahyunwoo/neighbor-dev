#!/usr/bin/env node
// 렌더된 HTML 과 빌드된 번들(.next/static)을 공개 검사기로 통과시킨다 — 데이터 검사만으로는 화면·청크에 실리는 것을 못 본다.
// 번들 검사는 서버 없이 디스크만 읽는다.
//   pnpm --filter @neighbor/web build && node scripts/verify-rendered.mjs --bundles-only
//   PORT=21200 pnpm --filter @neighbor/web start & node scripts/verify-rendered.mjs

import { existsSync, globSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLE_CHECKS, scanText } from './disclosure.mjs'
import { realCompanyNames } from './source.mjs'

const BASE = process.env.WEB_BASE_URL ?? 'http://localhost:21200'

const argv = process.argv.slice(2)
const BUNDLES_ONLY = argv.includes('--bundles-only')
const PAGES_ONLY = argv.includes('--pages-only')
if (BUNDLES_ONLY && PAGES_ONLY) {
  console.error('🔴 --bundles-only 와 --pages-only 를 같이 줄 수 없다.')
  process.exit(2)
}

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

// dev 서버면 멈춘다 — next dev 는 HTML 에 node_modules 경로를 실어 이메일 검사가 전부 오탐으로 빨개진다
// 정규식에 예외를 파서 고치지 않는다 — 진짜 이메일을 놓칠 길이 생긴다
function assertProd(html) {
  // dev 에만 나오는 두 표식(prod 빌드에는 0건)
  const devMark = html.includes('next-devtools') || html.includes('/node_modules/')
  if (!devMark) return
  console.error(`🔴 ${BASE} 는 dev 서버다. 이 검사는 **prod 빌드**에 대고 돌린다.`)
  console.error('')
  console.error('   dev 는 HTML 에 node_modules 경로를 싣고, 그것이 이메일 검사에 걸려')
  console.error('   모든 화면이 오탐으로 빨개진다(이슈 #32). 결과를 믿을 수 없다.')
  console.error('')
  console.error('   pnpm --filter @neighbor/web build')
  console.error('   PORT=21200 pnpm --filter @neighbor/web start &')
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
// 빌드된 청크 검사 — HTML 에 안 나와도 방문자는 받는다. (1) 공개 id 가 아닌 내부 식별자 (2) BUNDLE_CHECKS
// HTTP 가 아니라 디스크를 읽는다 — 런타임이 조립해 부르는 청크는 HTML 참조로 모으면 빠진다
function checkBundles() {
  // 원격을 가리키면 거부한다 — 화면은 배포처를, 번들은 내 맥을 보게 된다
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
  // 번들 범위를 정하는 유일한 지점 — CSS·소스맵도 주석·문자열을 실어 나른다
  const files = globSync(join(dir, '**/*.{js,css,map,mjs,cjs}'))
  if (files.length === 0) {
    console.error(`🔴 ${dir} 에 검사할 파일이 0개다. 검사가 아무것도 안 보고 초록을 낼 뻔했다.`)
    process.exit(2)
  }

  // (1) 내부 식별자 — 공개 id 목록에 없는 것만 위반
  const auditPath = join(ROOT, 'data/audit.json')
  if (!existsSync(auditPath)) {
    console.error(`🔴 감사 명단이 없다: ${auditPath} — 먼저 \`pnpm data\` 를 돌린다.`)
    process.exit(2)
  }
  const audit = JSON.parse(readFileSync(auditPath, 'utf8'))
  // 빈 명단으로 초록을 내지 않는다 — 대조가 no-op 이 된다
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
    // 값을 찍지 않는다 — 출력 자체가 유출이고 CI 로그에 남는다
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

// 안 돌린 검사는 통과가 아니라 건너뜀으로 적는다
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
