/**
 * 공개 데이터 읽기 — 빌드 타임에 생성된 JSON 하나만 본다.
 *
 * 🔴 정본(portfolio-source)을 여기서 읽지 않는다. 그건 PRIVATE 이고,
 *    걸러내는 일은 `scripts/build-data.mjs` 가 빌드 타임에 이미 했다.
 *
 * 🔴 타입이 층 규칙을 한 번 더 강제한다 — `SummaryProject` 에는 상세 필드가
 *    아예 없으므로, 화면에서 `summary.problem` 을 쓰면 타입 에러가 난다.
 *    지난 세션의 사고(경력 요약 층에 문제·판단·수치를 실음)가 정확히 이 형태였다.
 */

import generated from '../../../../data/generated/projects.json' with { type: 'json' }

/** 어느 층에서나 보이는 것 — 도메인 + 기간 + 스택. */
export interface BaseProject {
  id: string
  label: string
  period: string
  domain: string[]
  stack: string[]
}

/** 경력 요약 층. **상세 필드가 없다.** 이것이 타입 수준의 게이트다. */
export interface SummaryProject extends BaseProject {
  tier: 'summary'
}

export interface Decision {
  선택: string
  대안: string
  이유: string
  트레이드오프: string
}

export interface Metric {
  항목: string
  값: string
  /** 재현 명령. 없는 metric 은 빌드 단계에서 이미 걸러졌다(기획서 9절). */
  재현: string
}

/** 사례 상세 층. 문제·판단·수치까지 실을 수 있다. */
export interface DetailProject extends BaseProject {
  tier: 'detail'
  role?: string
  problem?: string
  decisions?: Decision[]
  metrics?: Metric[]
  scale?: string
}

export type Project = DetailProject | SummaryProject

interface Payload {
  generatedAt: string
  counts: { detail: number; summary: number; excluded: number }
  detail: DetailProject[]
  summary: SummaryProject[]
}

const payload = generated as unknown as Payload

/** 사례 상세 10건 — 최근 순. */
export function getDetailProjects(): DetailProject[] {
  return payload.detail
}

/** 경력 요약 6건 — 최근 순. */
export function getSummaryProjects(): SummaryProject[] {
  return payload.summary
}

export function getProject(id: string): Project | undefined {
  return [...payload.detail, ...payload.summary].find((p) => p.id === id)
}

/** 화이트보드(실적 화면)가 쓰는 전체 목록. */
export function getAllProjects(): Project[] {
  return [...payload.detail, ...payload.summary]
}

export function getCounts() {
  return payload.counts
}

export function getGeneratedAt(): string {
  return payload.generatedAt
}

/**
 * 책장(기술 스택 화면)이 쓰는 집계.
 * 두 층 모두 스택은 실을 수 있으므로 전체를 센다.
 */
export function getStackFrequency(): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const p of getAllProjects()) {
    // 같은 프로젝트 안의 중복은 한 번만 센다.
    for (const raw of new Set(p.stack)) {
      const name = normalizeStackName(raw)
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return (
    [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      // 🔴 한 번만 쓴 것은 싣지 않는다. 이 화면의 요지는 "무엇을 아는가" 가
      //    아니라 **"무엇을 반복해서 썼는가"** 다. 1회짜리를 다 실으면
      //    140종이 깔려 아무것도 안 읽힌다(실측 2026-09-09, 화면으로 확인).
      .filter((f) => f.count >= 2)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  )
}

/**
 * 한 프로젝트의 스택을 **화면에 쓸 기술명 목록**으로 줄인다.
 *
 * 🔴 화면은 정본의 `stack` 을 **그대로 쓰지 않는다.** 정본은 작업 노트라
 *    `PostgreSQL 16 (multi-schema)`, `Fastify 5 (@nestjs/platform-fastify)`
 *    처럼 **개발자용 내부 표기**를 담고 있다(212종 중 90종이 20자 초과 —
 *    2026-09-09 실측). 그게 카드 앞면에 깔리면 이 사이트를 보러 온
 *    발주자가 읽을 것이 사라진다(이슈 #2).
 *
 * `/stack` 화면은 이미 `normalizeStackName()` 으로 이 정리를 하고 있었는데
 * `/work`·`/career` 만 원시값을 쓰고 있었다 — 그래서 **같은 함수를 쓰게**
 * 묶는다. 화면마다 다른 규칙으로 줄이면 표기가 갈린다.
 *
 * @returns 중복을 뗀 기술명 목록. 기술명으로 볼 수 없는 서술은 빠진다.
 */
export function displayStack(stack: string[]): string[] {
  const out: string[] = []
  for (const raw of stack) {
    const name = normalizeStackName(raw)
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/**
 * 스택 이름을 기술명 하나로 줄인다.
 *
 * ⚠️ 정본의 `stack` 은 기술명이 아니라 **서술**을 담고 있다(실측 2026-09-09):
 *      "Next.js Route Handler — `/api/revalidate` (시크릿 검증 후 …)"
 *      "별도 저장소의 NestJS API 서버가 커밋한 스펙을 소비 (이 저장소에 서버 코드 없음)"
 *    그대로 태그로 쓰면 화면에 170종이 깔려 아무것도 안 읽힌다 — 실제로 그랬다.
 *
 * 그래서 (1) 괄호·수식어·버전을 떼고 (2) 그래도 문장인 것은 **버린다**.
 * 버리는 쪽을 택한 이유: 억지로 줄이면 없는 기술명을 만들어내게 된다.
 *
 * @returns 기술명, 또는 기술명으로 볼 수 없으면 null
 */
function normalizeStackName(raw: string): string | null {
  const name = raw
    // 괄호 설명: "PostgreSQL 17 (btree_gist, …)" → "PostgreSQL 17"
    .replace(/\s*\([^)]*\)/g, '')
    // 대시 뒤 설명: "Next.js Route Handler — `/api/…`" → "Next.js Route Handler"
    .replace(/\s+[—–-]\s+.*$/, '')
    // 조합 표기는 앞의 것만: "React Hook Form + Zod" → "React Hook Form"
    .replace(/\s*\+\s*.*$/, '')
    // 병기는 앞의 것만: "class-validator / class-transformer" → "class-validator"
    .replace(/\s*\/\s+.*$/, '')
    .trim()
    // 뒤에 붙은 버전: "NestJS 11" → "NestJS"
    .replace(/\s+v?\d+(\.\d+)*$/, '')
    .trim()

  if (!isTechName(name)) return null

  // 표기 흔들림을 합친다 — 대소문자·구두점만 다른 것은 같은 기술이다.
  return CANONICAL.get(canonicalKey(name)) ?? name
}

/**
 * CANONICAL 조회용 키. 공백·하이픈·점을 뗀 소문자.
 * ⚠️ 점을 빼먹으면 `Next.js …` 계열이 안 걸린다(실측: 키가 `next.jsroutehandler`).
 */
function canonicalKey(name: string): string {
  return name.toLowerCase().replace(/[\s.-]/g, '')
}

/** 같은 기술의 여러 표기를 하나로. 키는 `canonicalKey()` 형식. */
const CANONICAL = new Map<string, string>([
  ['dockercompose', 'Docker Compose'],
  ['turborepo', 'Turborepo'],
  ['tanstackreactquery', 'TanStack Query'],
  ['tanstackreacttable', 'TanStack Table'],
  ['pytest', 'pytest'],
  ['nextjs', 'Next.js'],
  ['nodejs', 'Node.js'],
  ['githubactions', 'GitHub Actions'],
  ['vitest', 'Vitest'],
  ['junit5', 'JUnit 5'],
  ['junit', 'JUnit'],
  // 표기만 다른 같은 라이브러리 (실측: 화면에 나란히 떠서 발견).
  ['reacthookform', 'React Hook Form'],
  // 프레임워크의 한 기능을 별도 종으로 세지 않는다.
  ['nextjsroutehandler', 'Next.js'],
  ['githubactionsci', 'GitHub Actions'],
  // 같은 것을 한글/영문으로 나눠 적은 경우 (실측: 커머스 건에 둘 다 있었다).
  ['바닐라javascript', 'Vanilla JavaScript'],
])

/**
 * 기술명으로 볼 수 있는가.
 * 문장·서술을 걸러낸다 — 여기서 걸린 것은 화면에 나오지 않는다.
 */
function isTechName(name: string): boolean {
  if (name.length === 0) return false
  // 조사·서술어가 붙은 것은 문장이다: "…를 소비", "…으로 빌드", "…이 없음"
  if (/(를|을|의|에|으로|로)\s|소비$|빌드$|없음$|대상$|기반$|생성$|사용$/.test(name)) return false
  // 한글이 두 어절 이상이면 서술로 본다 (기술명은 대개 한 덩어리다).
  if (/^[가-힣\s]+$/.test(name) && name.split(/\s+/).length >= 2) return false
  // ⚠️ 길이가 아니라 어절 수로 자른다. 길이로 자르면 `Vercel Serverless
  //    Functions`(25자) 같은 멀쩡한 제품명이 버려진다(실측 위양성).
  if (name.split(/\s+/).length > 3) return false
  return true
}
