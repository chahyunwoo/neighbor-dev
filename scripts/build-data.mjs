#!/usr/bin/env node
/**
 * portfolio-source(정본, PRIVATE) → data/generated/projects.json (공개 데이터)
 *
 * 빌드 타임에 한 번 돌고, 결과만 저장소에 커밋된다. 런타임 DB 가 필요 없다.
 *
 * 🔴 원본 저장소를 이 저장소에 복사하지 않는다. 읽기만 한다.
 * 🔴 허용목록 방식이라, 원본에 새 필드가 생겨도 조용히 새어나가지 않는다.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { anonymousLabelFor, sanitizeDeep } from './sanitize.mjs'
import { ALLOWED_FIELDS, TIER, tierOf } from './tiers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = process.env.PORTFOLIO_SOURCE ?? join(homedir(), 'Documents', 'portfolio-source')
const OUT_DIR = join(ROOT, 'data', 'generated')

function readProjects() {
  const dir = join(SOURCE, 'projects')
  if (!existsSync(dir)) {
    throw new Error(
      `정본을 찾을 수 없다: ${dir}\nPORTFOLIO_SOURCE 로 경로를 넘기거나 정본 저장소를 확인한다.`,
    )
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      return { ...raw, id: f.replace(/\.json$/, '') }
    })
}

/** 원본 `stack` 은 {frontend,backend,infra} 또는 배열. 평평한 배열로 만든다. */
function flattenStack(stack) {
  if (Array.isArray(stack)) return stack
  if (stack && typeof stack === 'object') {
    return [...(stack.frontend ?? []), ...(stack.backend ?? []), ...(stack.infra ?? [])]
  }
  return []
}

/**
 * 사명이 드러나는 서술을 익명 도메인 표기로 바꾼다.
 * `index.json` 의 domain 배열을 쓰고, 없으면 원본 project 문자열의 괄호 앞부분만.
 */
function labelOf(project, indexEntry) {
  // 익명 라벨이 지정된 건은 원본을 쓰지 않는다 (sanitize.mjs).
  const fixed = anonymousLabelFor(project.id)
  if (fixed) return fixed
  const named = indexEntry?.project ?? project.project ?? project.id
  // "제목 (스택 나열)" 형태에서 괄호 뒤를 떼어 라벨을 짧게 만든다.
  return String(named)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
}

/** metric 에서 클라이언트 트래커 접두사가 박힌 것은 항목 통째로 제외한다. */
function usableMetrics(metrics) {
  return (metrics ?? []).filter((m) => {
    const blob = `${m.항목 ?? ''} ${m.값 ?? ''} ${m.재현 ?? ''}`
    if (!m.재현 || String(m.재현).trim() === '') return false
    // 이슈키 형태가 재현 명령에 박혀 있으면 통째로 뺀다.
    if (/(?<![A-Za-z0-9])[A-Z]{2,5}-\d+(?![0-9])/.test(blob)) return false
    return true
  })
}

function project2public(project, indexEntry, tier) {
  const full = {
    id: project.id,
    tier,
    label: labelOf(project, indexEntry),
    period: project.period,
    domain: indexEntry?.domain ?? [],
    stack: flattenStack(project.stack),
    role: project.role,
    problem: project.problem ?? indexEntry?.problemSummary,
    decisions: project.decisions,
    metrics: usableMetrics(project.metrics),
    scale: indexEntry?.scale,
  }
  // 허용목록만 통과시킨다.
  const allowed = ALLOWED_FIELDS[tier]
  const out = {}
  for (const key of allowed) {
    if (full[key] !== undefined) out[key] = full[key]
  }
  // 통과한 것만 정제한다 — 정제가 허용목록을 우회하는 경로가 되지 않게.
  return sanitizeDeep(out)
}

function main() {
  const projects = readProjects()
  const index = JSON.parse(readFileSync(join(SOURCE, 'index.json'), 'utf8'))
  const byId = new Map(index.projects.map((p) => [p.id, p]))

  const detail = []
  const summary = []
  const excluded = []

  for (const p of projects) {
    const tier = tierOf(p)
    if (tier === TIER.NONE) {
      excluded.push(p.id)
      continue
    }
    const pub = project2public(p, byId.get(p.id), tier)
    ;(tier === TIER.DETAIL ? detail : summary).push(pub)
  }

  const sortKey = (p) => p.period ?? ''
  detail.sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
  summary.sort((a, b) => sortKey(b).localeCompare(sortKey(a)))

  mkdirSync(OUT_DIR, { recursive: true })
  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: { detail: detail.length, summary: summary.length, excluded: excluded.length },
    detail,
    summary,
  }
  writeFileSync(join(OUT_DIR, 'projects.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  process.stdout.write(
    `생성: data/generated/projects.json\n` +
      `  사례 상세 ${detail.length}건 · 경력 요약 ${summary.length}건 · 제외 ${excluded.length}건\n`,
  )
}

main()
