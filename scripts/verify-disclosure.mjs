#!/usr/bin/env node
// 생성된 공개 데이터를 검사한다 — 데이터를 바꿀 때마다 돌린다. 한 건이라도 걸리면 종료코드 1.
// 돌리는 법: node scripts/build-data.mjs && node scripts/verify-disclosure.mjs

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CHECK_NAMES,
  checkCardBody,
  checkMetricEvidence,
  checkNoPdfGeneration,
  checkPeriodCutoff,
  checkTierAssignment,
  checkTierRules,
  scanText,
} from './disclosure.mjs'
import { realCompanyNames } from './source.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'data', 'generated', 'projects.json')
// 감사 명단은 data/generated/ 밖에 둔다 — 앱의 @data/* 별칭이 그 폴더만 가리켜 앱이 부를 수 없게
const AUDIT = join(ROOT, 'data', 'audit.json')

function readManifests() {
  const files = [
    join(ROOT, 'package.json'),
    join(ROOT, 'apps', 'web', 'package.json'),
    join(ROOT, 'apps', 'api', 'package.json'),
  ]
  // verify-gates.py 가 실제 앱 파일 대신 탐침을 넘길 때 쓴다
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

  // 게재분(detail·summary)만 훑는다 — audit 는 검사기 전용이라 브라우저로 나가지 않는다. 실제 노출은 verify-rendered.mjs 가 본다
  const published = JSON.stringify({ detail: payload.detail, summary: payload.summary })
  for (const finding of scanText(published, realCompanyNames())) {
    // 회사표기는 값을 출력하면 그 자체가 유출이라 건수만 낸다
    const shown = finding.check === '회사표기' ? [`${finding.hits.length}건`] : finding.hits
    problems.push(`${finding.check}: ${shown.join(', ')}`)
  }

  for (const v of checkTierRules(all)) {
    problems.push(`층규칙: ${v.id} 의 summary 층에 상세 필드 '${v.field}' 가 있다`)
  }

  // 층 배정은 audit 로 본다 — 경력 요약은 공개 항목에 id 가 없다
  // 명단이 없으면 빈 배열로 넘어가지 않고 멈춘다 — 생성이 안 돈 것이다
  if (!existsSync(AUDIT)) {
    process.stderr.write(`감사 명단이 없다: ${AUDIT}\n먼저 \`pnpm data\` 를 돌린다.\n`)
    process.exit(1)
  }
  const audit = JSON.parse(readFileSync(AUDIT, 'utf8'))
  if (audit.length !== all.length) {
    problems.push(`층배정: 감사 명단이 ${audit.length}건인데 게재는 ${all.length}건이다`)
  }
  for (const v of checkTierAssignment(audit)) {
    problems.push(`층배정: ${v.id} — ${v.reason}`)
  }

  for (const v of checkCardBody(all)) {
    problems.push(`카드본문: ${v.id} — 카드로 그려지는데 cardBody 가 없다`)
  }

  for (const v of checkPeriodCutoff(all)) {
    problems.push(`게재컷: ${v.id} — ${v.reason}`)
  }

  for (const dep of checkNoPdfGeneration(readManifests())) {
    problems.push(`PDF생성의존성: ${dep} — 이력서 PDF 기능은 이 사이트에 구현하지 않는다`)
  }

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
