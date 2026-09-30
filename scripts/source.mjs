// 정본(portfolio-source, PRIVATE)을 읽는 입구 — 경로 해석은 여기서만 한다. 못 찾으면 빈 값 대신 throw 한다
// (조용히 통과하는 사명 유출 검사는 없느니만 못하다)

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// PORTFOLIO_SOURCE 를 주면 그 경로 하나만 본다 — 다음 후보로 조용히 넘어가면 틀린 지정이 초록으로 가려진다
// env 가 없을 때만 알려진 자리를 훑는다(옛 위치는 하위 호환)
function candidates() {
  const fromEnv = process.env.PORTFOLIO_SOURCE
  if (fromEnv) return [fromEnv]
  return [
    join(homedir(), 'dev', 'data', 'portfolio-source'),
    join(homedir(), 'Documents', 'portfolio-source'), // 옛 위치
  ]
}

// 디렉터리가 없으면 -1
function projectFileCount(dir) {
  const projects = join(dir, 'projects')
  if (!existsSync(projects)) return -1
  return readdirSync(projects).filter((f) => f.endsWith('.json')).length
}

// projects/*.json 이 실제로 들어 있는 자리만 인정한다 — 빈 껍데기(끊긴 클론·sparse checkout)를 0건 정상으로 읽지 않게
export function portfolioSourceDir() {
  const tried = candidates()
  const empty = []
  for (const dir of tried) {
    const n = projectFileCount(dir)
    if (n > 0) return dir
    if (n === 0) empty.push(dir)
  }
  throw new Error(
    [
      '정본(portfolio-source)을 쓸 수 없다. 아래를 순서대로 봤다:',
      ...tried.map((d) => {
        const n = projectFileCount(d)
        return `  · ${d}/projects — ${n < 0 ? '없음' : `비어 있음(.json 0건)`}`
      }),
      '',
      ...(empty.length
        ? ['⚠️ 디렉터리는 있는데 .json 이 0건이다 — 클론이 덜 됐거나 빈 껍데기다.', '']
        : []),
      'PORTFOLIO_SOURCE 로 경로를 넘기거나 정본 저장소를 확인한다.',
      '🔴 이 검사를 건너뛰고 진행하지 않는다 — 클라이언트 실명 유출 검사가 여기에 달려 있다.',
    ].join('\n'),
  )
}

// 정본의 미커밋 projects/*.json 목록 — build-data 가 파일 시스템을 그대로 읽어 같은 커밋에서도 결과가 달라진다
// git 을 못 쓰면 null — 빈 배열(변경 없음)과 갈라야 확인 실패가 통과로 읽히지 않는다
// index.json 은 자동 생성 파생물이라 보지 않는다 — 잡으면 파이프라인이 돌 때마다 푸시가 막혀 게이트가 꺼진다
export function dirtySourceFiles() {
  const dir = portfolioSourceDir()
  let out
  try {
    // -z — 한글 파일명이 "\352\270\260…" 로 이스케이프되는 것을 피한다
    out = execFileSync('git', ['-C', dir, 'status', '--porcelain', '-z'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null // git 저장소가 아니거나 git 을 못 쓴다 — "깨끗함" 과 가른다
  }
  return out
    .split('\0')
    .filter(Boolean)
    .map((line) => line.slice(3)) // "XY path"
    .filter((f) => f.startsWith('projects/') && f.endsWith('.json'))
}

// 푸시가 곧 배포다 — 개발 중에는 경고, --strict·pre-push 에서는 막는다
export function assertCleanSource({ strict = false } = {}) {
  const dirty = dirtySourceFiles()
  if (dirty === null) {
    process.stderr.write(
      '⚠️ 정본의 git 상태를 확인하지 못했다 — 파생물의 재현성을 보장할 수 없다.\n',
    )
    return
  }
  if (dirty.length === 0) return
  const msg = [
    `🔴 정본에 커밋되지 않은 변경이 ${dirty.length}건 있다:`,
    ...dirty.slice(0, 8).map((f) => `     · ${f}`),
    ...(dirty.length > 8 ? [`     … 외 ${dirty.length - 8}건`] : []),
    '   이 상태로 만든 파생물은 **재현되지 않는다** — 정본을 커밋하거나 되돌린 뒤 다시 돌린다.',
  ].join('\n')
  if (strict) throw new Error(msg)
  process.stderr.write(`${msg}\n`)
}

// id 는 파일명에서 온다
export function readSourceProjects() {
  const dir = join(portfolioSourceDir(), 'projects')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
      ...JSON.parse(readFileSync(join(dir, f), 'utf8')),
      id: f.replace(/\.json$/, ''),
    }))
}

// 제안서 매칭용 압축 색인
export function readSourceIndex() {
  return JSON.parse(readFileSync(join(portfolioSourceDir(), 'index.json'), 'utf8'))
}

// 검사에만 쓰고 출력하지 않는다 — 값을 찍는 순간 유출이다
export function realCompanyNames() {
  const projects = readSourceProjects()
  const names = new Set()
  for (const d of projects) {
    for (const key of ['client', 'projectNamed']) {
      const v = d[key]
      if (typeof v === 'string' && v.trim().length >= 2 && !/^(미상|unknown|개인)/i.test(v)) {
        names.add(v.trim())
      }
    }
  }
  // 빈 목록을 돌려주지 않는다 — 0건이면 회사표기 검사가 통째로 no-op 인데 화면은 똑같이 초록이다
  if (names.size === 0) {
    throw new Error(
      [
        `정본에서 사명을 한 건도 찾지 못했다 (프로젝트 ${projects.length}건을 읽었다).`,
        '🔴 0건은 "위반 없음" 이 아니라 **회사표기 검사가 통째로 꺼진다**는 뜻이다.',
        '',
        '정본이 낡았거나 부분 사본인지, client·projectNamed 필드 이름이 바뀌었는지 본다.',
        '정말 사명이 하나도 없는 것이 맞다면 이 검사를 조정하고 그 근거를 남긴다.',
      ].join('\n'),
    )
  }
  return [...names]
}
