// 빌드 타임에 걸러진 공개 JSON 만 본다 — PRIVATE 정본을 여기서 읽지 않는다. SummaryProject 에 상세 필드가 없는 것이 타입 게이트다.

import generated from '@data/projects.json' with { type: 'json' }

/** 어느 층에서나 보이는 것 — 도메인 + 기간 + 스택. */
export interface BaseProject {
  id: string
  label: string
  period: string
  domain: string[]
  stack: string[]
  /** 의뢰받은 일인가. client 값 자체는 싣지 않는다 — 익명이라도 조합하면 좁혀진다. */
  commissioned: boolean
}

/** 경력 요약 층. 상세 필드가 없는 것이 타입 수준의 게이트다. */
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
  /** 재현 명령. 없는 metric 은 빌드 단계에서 이미 걸러졌다. */
  재현: string
}

/** 상세 화면 맨 앞의 요약. 정본 `brief` 에서 온다. */
export interface Brief {
  summary: string
  problem: string[]
  role: string[]
  decisions: string[]
  metrics: string[]
}

/** 사례 상세 층. 문제·판단·수치까지 실을 수 있다. */
export interface DetailProject extends BaseProject {
  tier: 'detail'
  role?: string
  /** 카드 본문 한 문장. 상세의 `problem` 과 바꿔 쓰지 않는다. */
  cardBody?: string
  brief?: Brief
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

/** 두 층 모두 스택은 실을 수 있으므로 전체를 센다. */
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
      // 한 번만 쓴 것은 싣지 않는다 — 요지는 "반복해서 쓴 것" 이고, 다 실으면 안 읽힌다.
      .filter((f) => f.count >= 2)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  )
}

/** 정본 stack 을 화면용 기술명 목록으로 줄인다. 화면마다 같은 규칙을 쓰도록 여기서 묶는다. */
export function displayStack(stack: string[]): string[] {
  const out: string[] = []
  for (const raw of stack) {
    const name = normalizeStackName(raw)
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

// 정본 stack 은 서술이 섞여 있다. 괄호·수식어·버전을 떼고, 그래도 문장이면 버린다 — 없는 기술명을 만들지 않는다.
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

// 점까지 떼야 `Next.js …` 계열이 걸린다.
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
  // 표기만 다른 같은 라이브러리.
  ['reacthookform', 'React Hook Form'],
  // 프레임워크의 한 기능을 별도 종으로 세지 않는다.
  ['nextjsroutehandler', 'Next.js'],
  ['githubactionsci', 'GitHub Actions'],
  // 같은 것을 한글/영문으로 나눠 적은 경우.
  ['바닐라javascript', 'Vanilla JavaScript'],
])

// 문장·서술을 걸러낸다 — 여기서 걸린 것은 화면에 나오지 않는다.
function isTechName(name: string): boolean {
  if (name.length === 0) return false
  // 조사·서술어가 붙은 것은 문장이다: "…를 소비", "…으로 빌드", "…이 없음"
  if (/(를|을|의|에|으로|로)\s|소비$|빌드$|없음$|대상$|기반$|생성$|사용$/.test(name)) return false
  // 한글이 두 어절 이상이면 서술로 본다 (기술명은 대개 한 덩어리다).
  if (/^[가-힣\s]+$/.test(name) && name.split(/\s+/).length >= 2) return false
  // 길이가 아니라 어절 수로 자른다 — 길이로 자르면 멀쩡한 제품명이 버려진다.
  if (name.split(/\s+/).length > 3) return false
  return true
}
