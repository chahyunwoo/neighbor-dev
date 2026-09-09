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

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanText } from './disclosure.mjs'

const BASE = process.env.WEB_BASE_URL ?? 'http://localhost:3200'
const SOURCE = join(homedir(), 'Documents', 'portfolio-source')

function realCompanyNames() {
  const dir = join(SOURCE, 'projects')
  if (!existsSync(dir)) return []
  const names = new Set()
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    for (const k of ['client', 'projectNamed']) {
      const v = d[k]
      if (typeof v === 'string' && v.trim().length >= 2 && !/^(미상|unknown|개인)/i.test(v))
        names.add(v.trim())
    }
  }
  return [...names]
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
let bad = 0
for (const p of paths) {
  const html = await fetch(BASE + p).then((r) => r.text())
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
