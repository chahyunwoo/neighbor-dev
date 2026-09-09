#!/usr/bin/env node
/**
 * 생성된 공개 데이터를 12항목으로 검사한다. **데이터를 바꿀 때마다 돌린다.**
 *
 * 한 건이라도 걸리면 종료코드 1 — CI·훅에서 그대로 게이트로 쓴다.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CHECK_NAMES,
  checkMetricEvidence,
  checkNoPdfGeneration,
  checkPeriodCutoff,
  checkTierAssignment,
  checkTierRules,
  scanText,
} from './disclosure.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = process.env.PORTFOLIO_SOURCE ?? join(homedir(), 'Documents', 'portfolio-source')
const DATA = join(ROOT, 'data', 'generated', 'projects.json')

/**
 * 원본 `client` 필드에 든 실제 사명 목록을 모은다.
 * 이 파일에도 생성 데이터에도 사명을 적지 않기 위해, 검사에만 쓰고 출력하지 않는다.
 */
function realCompanyNames() {
  const dir = join(SOURCE, 'projects')
  if (!existsSync(dir)) return []
  const names = new Set()
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    for (const key of ['client', 'projectNamed']) {
      const v = d[key]
      if (typeof v === 'string' && v.trim().length >= 2 && !/^(미상|unknown|개인)/i.test(v)) {
        names.add(v.trim())
      }
    }
  }
  return [...names]
}

/** 워크스페이스의 package.json 들을 이어 읽는다. 없으면 빈 문자열. */
function readManifests() {
  const files = [
    join(ROOT, 'package.json'),
    join(ROOT, 'apps', 'web', 'package.json'),
    join(ROOT, 'apps', 'api', 'package.json'),
  ]
  // 게이트 검증(verify-gates.py)이 실제 앱 파일 대신 탐침을 넘길 때 쓴다.
  const probe = process.env.PDF_MANIFEST_EXTRA
  if (probe) files.push(probe)
  return files
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
}

function main() {
  if (!existsSync(DATA)) {
    process.stderr.write(`데이터가 없다: ${DATA}\n먼저 \`pnpm data\` 를 돌린다.\n`)
    process.exit(1)
  }
  const raw = readFileSync(DATA, 'utf8')
  const payload = JSON.parse(raw)
  const all = [...payload.detail, ...payload.summary]

  const problems = []

  /*
   * 1~10. 텍스트 검사
   *
   * ⚠️ **게재분(detail·summary)만 훑는다.** `audit` 는 검사기 전용 메타데이터라
   *    저장소에는 있어도 브라우저로 나가지 않는다(`lib/projects.ts` 가 안 읽는다).
   *    파일 전체를 훑으면 감사 명단의 저장소명이 위반으로 잡혀, 정작 잡아야 할
   *    "화면에 나간 것" 과 구별이 안 된다.
   *    🔴 화면에 실제로 나가는지는 `verify-rendered.mjs` 가 서버 HTML 로 확인한다.
   */
  const published = JSON.stringify({ detail: payload.detail, summary: payload.summary })
  for (const finding of scanText(published, realCompanyNames())) {
    // 회사표기는 값을 출력하면 그 자체가 유출이므로 건수만 낸다.
    const shown = finding.check === '회사표기' ? [`${finding.hits.length}건`] : finding.hits
    problems.push(`${finding.check}: ${shown.join(', ')}`)
  }

  // 11. 층 규칙
  for (const v of checkTierRules(all)) {
    problems.push(`층규칙: ${v.id} 의 summary 층에 상세 필드 '${v.field}' 가 있다`)
  }

  /*
   * 12. 층 배정 — 명단을 직접 검사한다 (checkTierRules 로는 안 잡히는 형태)
   *
   * 🔴 **`audit` 를 본다.** 경력 요약 건은 `id` 가 저장소명이라 공개 항목에서
   *    뺐는데(`tiers.mjs`), 그러자 이 검사가 `p.id` 를 못 읽어 게재 금지 건이
   *    실려도 안 잡히게 됐다(실측: verify-gates 의 M6 이 '못 잡음' 이 됐다).
   *    검사에 필요한 것과 화면에 나가는 것을 가른다.
   */
  const audit = payload.audit ?? []
  if (audit.length !== all.length) {
    problems.push(`층배정: 감사 명단이 ${audit.length}건인데 게재는 ${all.length}건이다`)
  }
  for (const v of checkTierAssignment(audit)) {
    problems.push(`층배정: ${v.id} — ${v.reason}`)
  }

  // 13. 게재 컷 — 2025.04 이전 건이 실렸는가
  for (const v of checkPeriodCutoff(all)) {
    problems.push(`게재컷: ${v.id} — ${v.reason}`)
  }

  // 14. 소스에 PDF 생성 의존성이 들어왔는가 (CLAUDE.md 4번)
  for (const dep of checkNoPdfGeneration(readManifests())) {
    problems.push(`PDF생성의존성: ${dep} — 이력서 PDF 기능은 이 사이트에 구현하지 않는다`)
  }

  // 14. 재현 명령 없는 metric
  for (const m of checkMetricEvidence(all)) {
    problems.push(`재현없는metric: ${m.id} / ${m.항목}`)
  }

  const label = `공개 검사 ${CHECK_NAMES.length}항목`
  if (problems.length === 0) {
    process.stdout.write(
      `${label} — 전부 통과 (사례 상세 ${payload.counts.detail} · 경력 요약 ${payload.counts.summary})\n`,
    )
    return
  }
  process.stderr.write(`${label} — ${problems.length}건 위반\n`)
  for (const p of problems) process.stderr.write(`  🔴 ${p}\n`)
  process.exit(1)
}

main()
