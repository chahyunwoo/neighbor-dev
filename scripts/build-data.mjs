#!/usr/bin/env node
/**
 * portfolio-source(정본, PRIVATE) → data/generated/projects.json (공개 데이터)
 *
 * 빌드 타임에 한 번 돌고, 결과만 저장소에 커밋된다. 런타임 DB 가 필요 없다.
 *
 * 🔴 원본 저장소를 이 저장소에 복사하지 않는다. 읽기만 한다.
 * 🔴 허용목록 방식이라, 원본에 새 필드가 생겨도 조용히 새어나가지 않는다.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { anonymousCardBodyFor, anonymousLabelFor, publicIdFor, sanitizeDeep } from './sanitize.mjs'
import { readSourceIndex, readSourceProjects } from './source.mjs'
import { ALLOWED_FIELDS, TIER, tierOf } from './tiers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'data', 'generated')

/*
 * 🔴 **감사 명단은 `data/generated/` 밖에 둔다.** 앱의 경로 별칭이
 *    `@data/*` → `data/generated/*` 이므로(`apps/web/tsconfig.json`),
 *    여기에 두면 앱에서 `@data/` 로 **부를 수 없다.** 상대경로(`../`)는
 *    FSD 검사기가 이미 막는다 — 구조가 차단하지 사람이 조심하는 게 아니다.
 *
 *    같은 폴더에 두면 안 되는 이유는 실측으로 나왔다(#78): `projects.json`
 *    하나를 통째로 default import 하면 **타입에 없는 키까지 번들에 실린다.**
 */
const AUDIT_FILE = join(ROOT, 'data', 'audit.json')

// 경로 해석과 읽기는 source.mjs 하나가 맡는다 — 못 찾으면 거기서 throw 한다.
const readProjects = readSourceProjects

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
  /*
   * 🔴 **익명 라벨이 1순위다. 여기를 내리지 않는다.**
   *    `anonymousLabelFor` 는 개인 사이트 도메인이 라벨로 나가는 것을 막는
   *    방어선이고, 정본이 쓴 `headline` 을 그 위에 두면 사람이 손으로 쓴
   *    문자열이 방어선을 우회한다. `verify-gates.py` 의 M2 가 그 자리에서
   *    빨개지도록 설계돼 있다 — 우선순위를 뒤집으면 게이트가 먼저 말해준다.
   */
  const fixed = anonymousLabelFor(project.id)
  if (fixed) return fixed

  /*
   * 화면용 한 줄. 정본이 비개발자 언어로 직접 쓴 값이다(#80).
   *
   * 🔴 **`??` 를 쓰지 않는다** — `"headline": ""` 이 통과해 카드 제목이 사라진다.
   *    정본은 사람이 쓰는 파일이라 실제로 일어난다. trim 길이로 본다.
   * 🔴 **아래 괄호 정리를 적용하지 않는다** — 사람이 화면용으로 쓴 값이라
   *    가공하면 안 된다. `견적 요청(RFQ)` 처럼 괄호로 끝나면 통째로 날아간다.
   */
  const headline = typeof project.headline === 'string' ? project.headline.trim() : ''
  if (headline) return headline

  const named = indexEntry?.project ?? project.project ?? project.id
  // "제목 (스택 나열)" 형태에서 괄호 뒤를 떼어 라벨을 짧게 만든다.
  return String(named)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
}

/**
 * 카드 본문 한 문장(#84). **제목과 두 자리의 독자가 다르다** —
 * 카드는 목록을 훑는 발주자가 읽고, 상세의 「무엇이 문제였나」(`problem`)는
 * 더 읽으러 들어온 사람이 읽는다. 그래서 `problem` 을 자르지 않고 따로 둔다.
 *
 * 🔴 **익명 본문이 1순위다** — `labelOf` 와 같은 이유(방어선을 정본 자유
 *    텍스트가 우회하지 못하게). 순서를 뒤집으면 개인 도메인이 본문으로 나간다.
 * 🔴 **`??` 를 쓰지 않는다** — `"cardBody": ""` 가 통과해 카드 본문이 빈 채
 *    자리만 차지한다. 정본은 사람이 쓰는 파일이라 실제로 일어난다.
 * ⚠️ 없으면 `undefined` 를 돌려준다 — **`problem` 으로 폴백하지 않는다.**
 *    폴백하면 #84 가 고치려던 개발자 언어가 조용히 되돌아온다.
 */
function cardBodyOf(project) {
  const fixed = anonymousCardBodyFor(project.id)
  if (fixed) return fixed

  const body = typeof project.cardBody === 'string' ? project.cardBody.trim() : ''
  return body || undefined
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

/**
 * **의뢰받아 만든 일인가.** 직접 만든 것(개인 사이트·도구)과 가른다.
 *
 * 🔴 **`client` 값 자체는 내보내지 않는다.** 익명 표기(`중소기업 P사`)라도
 *    화면에 실을 이유가 없고, 여러 건을 나란히 놓으면 조합으로 좁혀진다.
 *    **불리언 하나만** 내보낸다.
 *
 * 🔴 왜 필요한가: 사례 상세 10건 중 **8건이 본인 개인 사이트·도구**라
 *    비개발자 방문자에게는 "자기 블로그를 여덟 번 만들었네" 로 읽힌다.
 *    기획서 3절이 정확히 그 위험을 적어놨다 —
 *    *"사례 상세를 개인 프로젝트로만 채우면 취미 개발자로 읽힐 위험이 있다."*
 *    → 의뢰받은 일을 앞에 세운다.
 *
 * ⚠️ 판정은 **정본의 `client`** 로만 한다. 라벨 문자열("개인 기술 …")로
 *    맞히면 라벨을 다듬는 순간 조용히 어긋난다.
 */
const SELF_CLIENTS = new Set(['1인 기업 N사', '개인 프로젝트'])
function isCommissioned(project) {
  const c = project.client
  return typeof c === 'string' ? !SELF_CLIENTS.has(c.trim()) : true
}

function project2public(project, indexEntry, tier) {
  const full = {
    // 🔴 저장소명을 URL 로 내보내지 않는다(`publicIdFor` 주석 참고).
    id: publicIdFor(project.id),
    tier,
    label: labelOf(project, indexEntry),
    period: project.period,
    domain: indexEntry?.domain ?? [],
    commissioned: isCommissioned(project),
    stack: flattenStack(project.stack),
    role: project.role,
    cardBody: cardBodyOf(project),
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
  const index = readSourceIndex()
  const byId = new Map(index.projects.map((p) => [p.id, p]))

  let detail = []
  let summary = []
  // 감사 명단용 — 정본 id 를 층별로 짝지어 둔다(공개 항목에는 안 들어간다).
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

  /*
   * ⚠️ 정렬은 **id 와 짝을 유지한 채** 한다. 따로 정렬하면 감사 명단의
   *    id 가 엉뚱한 항목에 붙어 검사가 조용히 틀린 것을 본다.
   */
  /*
   * 🔴 **의뢰받은 일이 먼저다.** 그 안에서 최신순.
   *    전에는 기간만 봐서 개인 사이트 6건이 위를 다 덮었다.
   */
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

  /*
   * 🔴 **감사용 명단 — 별도 파일.** 어느 정본 항목이 어느 층으로 나갔는지
   *    검사기가 확인할 수 있게 남긴다. 경력 요약 건의 `id` 는 저장소명이라
   *    공개 항목에서 뺐는데(`tiers.mjs` 의 ALLOWED_FIELDS), 그러자 층 배정
   *    검사가 `p.id` 를 못 읽어 **게재 금지 건이 실려도 안 잡히게 됐다**
   *    (실측: verify-gates 의 M6 이 '못 잡음' 으로 바뀌었다).
   *    검사에 필요한 것과 화면에 나가는 것을 가른다.
   *
   * ⚠️ **전에는 이걸 payload 안에 뒀다가 번들로 샜다**(#78). 주석에는
   *    "번들에 들어가지 않는다" 고 적혀 있었고 확인 명령이
   *    `curl /career | grep -c` 였다 — **HTML 만 봤다.** 실제로는
   *    `'use client'` 인 3D 씬이 `@data/projects.json` 을 통째로 import 해
   *    타입에 없는 `audit` 까지 청크에 실렸다.
   *    지금은 `verify-rendered.mjs` 가 청크까지 훑는다.
   */
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

main()
