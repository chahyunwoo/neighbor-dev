/**
 * 정본(portfolio-source, PRIVATE) 을 읽는 입구. **경로 해석은 여기서만 한다.**
 *
 * 🔴 못 찾으면 throw 한다. 빈 값을 돌려주지 않는다.
 *
 *    실측 2026-09-16: 정본이 `~/Documents/portfolio-source` 에서 옮겨졌는데
 *    이 저장소가 따라가지 않았다. 그때 `verify-rendered.mjs` 는 경로가 없으면
 *    `return []` 으로 넘어가도록 돼 있어서, **사명 유출 검사가 아무것도 하지
 *    않으면서 초록을 냈다.** 이 저장소는 PUBLIC 이고 검사 대상은 클라이언트
 *    실명이다 — 조용히 통과하는 검사는 없느니만 못하다.
 *
 * 🔴 경로 해석이 세 파일에 흩어져 있던 것이 원인이었다. 하나를 고쳐도 나머지가
 *    남았고, 셋의 실패 동작(throw / 빈 배열 / 빈 배열)이 제각각이었다.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * 찾아볼 자리. 앞이 우선이다.
 *
 * 🔴 `PORTFOLIO_SOURCE` 를 준 경우 **그 경로 하나만** 본다. 없으면 실패한다.
 *
 *    처음엔 env 를 후보 목록의 맨 앞에 얹었는데, 되돌리기 검증에서 **없는
 *    경로를 넘겨도 초록이 떴다** — 다음 후보로 조용히 넘어가 진짜 정본을
 *    찾아버렸다. 이 파일이 없애려던 "조용한 폴백" 을 형태만 바꿔 다시 만든
 *    꼴이다. 사람이 자리를 지정했으면 거기만 보고, 틀렸으면 틀렸다고 말한다.
 *
 * ⚠️ env 가 없을 때만 알려진 자리를 훑는다. 옛 위치를 남겨 둔 것은 하위
 *    호환이지 기본값이 아니다 — 맥마다 배치가 다를 수 있어서 남긴다.
 */
function candidates() {
  const fromEnv = process.env.PORTFOLIO_SOURCE
  if (fromEnv) return [fromEnv]
  return [
    join(homedir(), 'dev', 'data', 'portfolio-source'),
    join(homedir(), 'Documents', 'portfolio-source'), // 2026-09-10 이전 위치
  ]
}

/** `projects/` 안의 `.json` 개수. 디렉터리가 없으면 -1. */
function projectFileCount(dir) {
  const projects = join(dir, 'projects')
  if (!existsSync(projects)) return -1
  return readdirSync(projects).filter((f) => f.endsWith('.json')).length
}

/**
 * 정본 저장소 경로. **`projects/*.json` 이 실제로 들어 있는 자리만** 인정한다.
 *
 * 🔴 디렉터리 존재만 보면 안 된다. 빈 껍데기가 남아 있으면 프로젝트 0건을
 *    정상으로 읽어 검사가 통과한 것처럼 보인다 — 클론이 중간에 끊겼거나
 *    sparse checkout 인 기계에서 실제로 일어난다.
 *
 *    ⚠️ 이 파일의 첫 판은 주석에 그렇게 써 놓고 **구현은 `existsSync` 만 했다.**
 *       빈 `projects/` 를 넘기자 사명이 박힌 데이터가 그대로 통과했다(exit 0).
 *       주석이 막겠다고 한 것과 코드가 막는 것은 다르다.
 */
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

/**
 * 정본에 **커밋되지 않은 변경**이 있는가. 있으면 그 파일 목록을 돌려준다 (이슈 #90).
 *
 * 🔴 왜 보는가: `build-data.mjs` 는 정본을 파일 시스템에서 그대로 읽는다. 정본에
 *    미커밋 변경이 있으면 그것이 파생물에 들어가고, **같은 커밋에서 돌려도 결과가
 *    달라진다.** 실측 2026-09-17: 정본의 미커밋 domain 순서 변경이 `main` 에
 *    실려 배포됐고, `/work` 기술용어가 상한을 넘겨 게이트가 병합 **뒤에** 잡았다.
 *    (게다가 `pnpm verify` 가 `pnpm data` 를 포함하므로 손으로 고쳐도 되돌아간다.)
 *
 * ⚠️ **정본이 git 저장소가 아니거나 git 을 못 쓰면 `null`** 을 돌려준다.
 *    "변경 없음(빈 배열)" 과 **가르는 것이 중요하다** — 둘을 같게 만들면
 *    확인 실패가 통과로 읽힌다(CLAUDE.md: 0 은 "없다" 가 아니라 "못 읽었다" 일 수 있다).
 *
 * 🔴 **`projects/*.json` 만 본다.** 정본의 `index.json` 은 사람이 쓰는 파일이 아니라
 *    launchd 작업(`com.chahyunwoo.portfolio-sync`)이 `projects/` 를 감시해 다시
 *    만드는 **파생물**이다. 그것까지 잡으면 파이프라인이 돌 때마다 푸시가 막혀
 *    사람이 이 게이트를 꺼 버린다 — 실측 2026-09-17: 되돌리기 검증으로
 *    `projects/*.json` 을 건드릴 때마다 `index.json` 이 재생성돼 훅이 두 번 막았다.
 *
 *    잡으려는 것은 **사람이 고치다 만 상태**이지 자동 생성물의 갱신이 아니다.
 * ⚠️ 그래서 `index.json` 이 흔들리는 것은 여기서 못 잡는다. 그쪽은
 *    파이프라인 저장소가 책임진다(그 출력이 곧 정본이다).
 * @returns {string[] | null} 변경된 경로들, 또는 확인 불가 시 null
 */
export function dirtySourceFiles() {
  const dir = portfolioSourceDir()
  let out
  try {
    // -z 로 받는다 — 한글 파일명이 `"\352\270\260…"` 로 이스케이프되는 것을 피한다
    // (이 저장소의 pre-commit 훅이 같은 함정을 밟았다).
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

/**
 * 정본이 더러우면 경고한다. `strict` 면 멈춘다.
 *
 * 🔴 **푸시가 곧 배포다.** 개발 중에는 경고로 두되, 나가는 자리
 *    (`--strict`·`.githooks/pre-push`)에서는 막는다.
 */
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

/** 정본의 `projects/*.json` 을 전부 읽는다. `id` 는 파일명에서 온다. */
export function readSourceProjects() {
  const dir = join(portfolioSourceDir(), 'projects')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
      ...JSON.parse(readFileSync(join(dir, f), 'utf8')),
      id: f.replace(/\.json$/, ''),
    }))
}

/** 정본의 `index.json`(제안서 매칭용 압축 색인). */
export function readSourceIndex() {
  return JSON.parse(readFileSync(join(portfolioSourceDir(), 'index.json'), 'utf8'))
}

/**
 * 원본에 든 실제 사명 목록. **검사에만 쓰고 출력하지 않는다** —
 * 값을 찍는 순간 그게 곧 유출이다(호출부는 건수만 낸다).
 */
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
  /*
   * 🔴 빈 목록을 돌려주지 않는다.
   *
   *    `disclosure.mjs` 의 회사표기 검사는 기본 구현이 `() => []` 이고, 넘어온
   *    목록이 비면 **그 검사가 통째로 no-op 이 된다**(`extraCompanyNames.length > 0`
   *    조건). 즉 0건은 "위반 없음" 이 아니라 "검사 안 함" 인데 화면에는 똑같이
   *    초록으로 보인다. 실측 2026-09-16 기준 23개 파일에서 17건이 나온다.
   */
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
