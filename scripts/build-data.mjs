#!/usr/bin/env node
// portfolio-source(정본, PRIVATE) → data/generated/projects.json(공개 데이터). 정본은 읽기만 하고 복사하지 않는다.
// 허용목록 방식이라 원본에 새 필드가 생겨도 조용히 새지 않는다.
// 돌리는 법: node scripts/build-data.mjs [--strict]

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { briefMetricBacked } from './disclosure.mjs'
import { anonymousLabelFor, publicIdFor, sanitizeDeep } from './sanitize.mjs'
import { assertCleanSource, readSourceIndex, readSourceProjects } from './source.mjs'
import { ALLOWED_FIELDS, TIER, tierOf } from './tiers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'data', 'generated')

// 감사 명단은 data/generated/ 밖에 둔다 — 앱의 @data/* 별칭 밖이라 앱이 부를 수 없고, 같이 import 되어 번들에 실리지 않는다
const AUDIT_FILE = join(ROOT, 'data', 'audit.json')

const readProjects = readSourceProjects

// 원본 stack 은 {frontend,backend,infra} 또는 배열
function flattenStack(stack) {
  if (Array.isArray(stack)) return stack
  if (stack && typeof stack === 'object') {
    return [...(stack.frontend ?? []), ...(stack.backend ?? []), ...(stack.infra ?? [])]
  }
  return []
}

function labelOf(project, indexEntry) {
  // 익명 라벨이 1순위다 — headline 을 위에 두면 손으로 쓴 문자열이 방어선을 우회한다(verify-gates.py M2)
  const fixed = anonymousLabelFor(project.id)
  if (fixed) return fixed

  // ?? 금지 — "headline": "" 이 통과해 카드 제목이 사라진다. 사람이 쓴 화면용 값이라 아래 괄호 정리도 하지 않는다
  const headline = typeof project.headline === 'string' ? project.headline.trim() : ''
  if (headline) return headline

  const named = indexEntry?.project ?? project.project ?? project.id
  // "제목 (스택 나열)" 에서 괄호 뒤를 뗀다
  return String(named)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
}

// 카드 본문은 problem 과 독자가 달라 따로 둔다. ?? 금지(빈 문자열이 통과한다), problem 폴백 금지(개발자 언어가 되돌아온다) —
// 없으면 없는 채로 두고 checkCardBody 가 말하게 한다
function cardBodyOf(project) {
  const body = typeof project.cardBody === 'string' ? project.cardBody.trim() : ''
  return body || undefined
}

// 재현 명령이 없거나 클라이언트 트래커 이슈키가 박힌 metric 은 통째로 뺀다
function usableMetrics(metrics) {
  return (metrics ?? []).filter((m) => {
    const blob = `${m.항목 ?? ''} ${m.값 ?? ''} ${m.재현 ?? ''}`
    if (!m.재현 || String(m.재현).trim() === '') return false
    if (/(?<![A-Za-z0-9])[A-Z]{2,5}-\d+(?![0-9])/.test(blob)) return false
    return true
  })
}

// 의뢰받은 일인가 — client 값은 내보내지 않고 불리언 하나만(익명 표기도 나란히 놓으면 조합으로 좁혀진다)
// 판정은 정본 client 로만 한다 — 라벨 문자열로 맞히면 라벨을 다듬는 순간 어긋난다
const SELF_CLIENTS = new Set(['1인 기업 N사', '개인 프로젝트', '자체 개발'])
function isCommissioned(project) {
  const c = project.client
  return typeof c === 'string' ? !SELF_CLIENTS.has(c.trim()) : true
}

const BRIEF_LISTS = ['problem', 'role', 'decisions', 'metrics']

// 모양이 하나라도 어긋나면(빈 목록 포함) 통째로 뺀다 — 반쯤 그려진 요약보다 원문이 낫다
// 지표 줄은 재현 명령이 있는 지표에 숫자가 전부 있을 때만 싣는다
function briefOf(project) {
  const b = project.brief
  if (!b || typeof b.summary !== 'string' || !b.summary.trim()) return undefined
  const lists = {}
  for (const k of BRIEF_LISTS) {
    if (!Array.isArray(b[k]) || !b[k].every((x) => typeof x === 'string' && x.trim())) {
      return undefined
    }
    lists[k] = b[k].map((x) => x.trim())
  }
  const usable = usableMetrics(project.metrics)
  lists.metrics = lists.metrics.filter((line) => briefMetricBacked(line, usable))
  if (BRIEF_LISTS.some((k) => lists[k].length === 0)) return undefined
  return { summary: b.summary.trim(), ...lists }
}

function project2public(project, indexEntry, tier) {
  const full = {
    // 저장소명을 URL 로 내보내지 않는다
    id: publicIdFor(project.id),
    tier,
    label: labelOf(project, indexEntry),
    period: project.period,
    domain: indexEntry?.domain ?? [],
    commissioned: isCommissioned(project),
    stack: flattenStack(project.stack),
    role: project.role,
    cardBody: cardBodyOf(project),
    brief: briefOf(project),
    problem: project.problem ?? indexEntry?.problemSummary,
    decisions: project.decisions,
    metrics: usableMetrics(project.metrics),
    scale: indexEntry?.scale,
  }
  const allowed = ALLOWED_FIELDS[tier]
  const out = {}
  for (const key of allowed) {
    if (full[key] !== undefined) out[key] = full[key]
  }
  // 통과한 것만 정제한다 — 정제가 허용목록을 우회하는 경로가 되지 않게
  return sanitizeDeep(out)
}

function main() {
  // 정본이 깨끗한지 먼저 본다 — 미커밋 변경이 섞이면 같은 커밋에서도 파생물이 달라진다. --strict(pre-push)면 멈춘다
  assertCleanSource({ strict: process.argv.includes('--strict') })

  const projects = readProjects()
  const index = readSourceIndex()
  const byId = new Map(index.projects.map((p) => [p.id, p]))

  let detail = []
  let summary = []
  // 감사 명단용 — 정본 id 를 층별로 짝지어 둔다(공개 항목에는 안 들어간다)
  let detailIds = []
  let summaryIds = []
  const excluded = []

  for (const p of projects) {
    const tier = tierOf(p)
    if (tier === TIER.NONE) {
      excluded.push(p.id)
      continue
    }
    const pub = project2public(p, byId.get(p.id), tier)
    if (tier === TIER.DETAIL) {
      detail.push(pub)
      detailIds.push(p.id)
    } else {
      summary.push(pub)
      summaryIds.push(p.id)
    }
  }

  // 정렬은 id 와 짝을 유지한 채 한다 — 따로 정렬하면 감사 명단 id 가 엉뚱한 항목에 붙는다
  // 의뢰받은 일이 먼저, 그 안에서 최신순
  const sortKey = (p) => `${p.commissioned ? '1' : '0'}\u0000${p.period ?? ''}`
  const pairSort = (items, ids) => {
    const pairs = items.map((v, i) => [v, ids[i]])
    pairs.sort((a, b) => sortKey(b[0]).localeCompare(sortKey(a[0])))
    return [pairs.map((x) => x[0]), pairs.map((x) => x[1])]
  }
  ;[detail, detailIds] = pairSort(detail, detailIds)
  ;[summary, summaryIds] = pairSort(summary, summaryIds)

  mkdirSync(OUT_DIR, { recursive: true })
  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: { detail: detail.length, summary: summary.length, excluded: excluded.length },
    detail,
    summary,
  }
  writeFileSync(join(OUT_DIR, 'projects.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  // 감사 명단은 별도 파일 — payload 안에 두면 'use client' 씬의 import 를 타고 번들로 샌다
  const audit = [
    ...detail.map((p, i) => ({ tier: p.tier, id: detailIds[i] })),
    ...summary.map((p, i) => ({ tier: p.tier, id: summaryIds[i] })),
  ]
  writeFileSync(AUDIT_FILE, `${JSON.stringify(audit, null, 2)}\n`, 'utf8')

  process.stdout.write(
    `생성: data/generated/projects.json\n` +
      `  사례 상세 ${detail.length}건 · 경력 요약 ${summary.length}건 · 제외 ${excluded.length}건\n`,
  )
}

// 스택 트레이스를 보이지 않는다 — assertCleanSource 가 던지는 것은 사람이 읽고 조치할 안내다
try {
  main()
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
}
