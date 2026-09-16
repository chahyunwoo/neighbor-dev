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
 * 쓰는 법 (서버가 떠 있어야 한다):
 *     cd apps/web && pnpm build && pnpm start &
 *     node scripts/verify-rendered.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanText } from './disclosure.mjs'
import { realCompanyNames } from './source.mjs'

const BASE = process.env.WEB_BASE_URL ?? 'http://localhost:3200'

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
for (const p of paths) {
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
console.log(
  bad === 0
    ? `✅ 렌더된 ${paths.length}개 화면 전부 통과`
    : `🔴 ${bad}/${paths.length} 화면에서 위반`,
)
process.exit(bad === 0 ? 0 : 1)
