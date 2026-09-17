# AGENTS.md — neighbor-dev

- **진행 상태(지금·다음·막힘)는 이 파일이 아니라 볼트** `~/dev/data/vault/projects/neighbor-dev/현황.md` — 세션 끝에 `/handoff`.
- **3D 씬·모션·프로브 함정은 `.claude/rules/3d-probe.md` 로 갈랐다**(2026-09-17). `features/room-3d/` 나 `scripts/probes/` 를 만질 때만 자동 로드된다.

# neighbor-dev

이웃집 개발자 회사 홈페이지. **기술 쇼케이스가 목적**이고, 수주 문의는 그 결과다.

기획 확정본은 `docs/기획.md` 에 있다(**gitignore 대상 — 로컬에만 존재**).
작업 시작 전에 반드시 읽는다. 아래는 그중 **어기면 사고가 나는 것**만 추린 것이다.

## 🔴 이 저장소는 PUBLIC 이다

커밋하는 모든 것이 공개된다. 특히:

- **`.env` 계열을 절대 커밋하지 않는다.** `.env.example` 에도 실값을 넣지 않는다
  (다른 프로젝트에서 Keycloak client secret 이 `.env.example` 에 평문으로 커밋된 실례가 있다).
- **토스 테스트키도 커밋하지 않는다.** 테스트키라도 공개 저장소에 두지 않는다.
- **`docs/` 를 커밋하지 않는다.** 개인 도메인이 언급된다. `.gitignore` 에 걸려 있으니 풀지 말 것.

## 🔴 공개 금지 — 산출물에 옮기지 않는다

1. **클라이언트사명은 전부 익명.** 예외 없다. "금융 백오피스", "물류 관제" 같은
   도메인 표기만 쓴다. `clientSafe: true` 인 건도 마찬가지다.
2. **`payment-gateway-api` 의 상태 전이표를 시각화하지 않는다.**
   해당 항목 `nonDisclosure` 에 "표의 값은 옮기지 않는다"고 명시돼 있다.
   → 결제 3D 의 재료는 **`booking-settlement`** 다(자체 솔루션, `clientSafe: true`).
3. **기존 개인 사이트의 도메인과 그 저장소 링크를 적지 않는다.**
   (어느 것인지는 `docs/기획.md` 7절 참고 — 이 파일에는 도메인 자체를 쓰지 않는다.)
   저장소가 PUBLIC 인 것과 별개로, 우리가 먼저 링크를 뿌리지 않는다는 방침이다(2026-09-04).
   두 사이트는 **완전 분리** — 상호 링크 없음, 공유 패키지 없음.
4. **이력서 PDF 생성 기능을 옮겨오지 않는다.** 실명·연락처가 들어간다.
5. **업무 규칙을 쓰지 않는다.** 기술 과제(상태 동기화·멱등성·정산 계산 구조)는 쓰되,
   그 위에 얹힌 수수료 계산식·심사 기준·임계치는 쓰지 않는다.

## 🔴 근거 없는 수치를 쓰지 않는다

홈페이지에 수치를 실으면 정본(`portfolio-source`)의 `projects/*.json` 의
`metrics[]` 에 **재현 명령이 있는 것만** 쓴다. 없으면 쓰지 않는다.

실적 게재 범위: **2025.04 이후 17건**. 이전 6건은 싣지 않는다.

```bash
cd "${PORTFOLIO_SOURCE:-$HOME/dev/data/portfolio-source}" && python3 -c "
import json,re
d=json.load(open('index.json'))
def s(p):
    m=re.match(r'(\d{4})\.(\d{2})', p['period']); return (int(m.group(1)),int(m.group(2))) if m else (0,0)
inc=[p for p in d['projects'] if s(p)>=(2025,4)]
print(len(inc), len(d['projects'])-len(inc))"
# → 17 6
```

## ⚠️ AI 자가진단 — 하지 말 것

- **견적 금액을 AI 가 말하게 하지 않는다.** 범위 정리·기술 판단까지만.
  금액이 나오면 그 숫자가 협상 기준선이 된다.
- **실적을 지어내게 하지 않는다.** `index.json` 의 구조화 데이터를 근거로만 답하게 한다.
- **AI 출력에 사명이 등장하지 않게 한다.**

## ⚠️ 포트와 터널은 공유 자원이다

이 맥에서 여러 프로젝트가 포트와 `cloudflared` 를 나눠 쓴다.
띄우기 **전에** 매번 센다 — "아마 비어 있을 것"을 사실로 받아들이지 않는다.

```bash
lsof -nP -iTCP -sTCP:LISTEN
docker ps --format '{{.Names}}\t{{.Ports}}'
ps aux | grep -i '[c]loudflared'
```

2026-09-08 실측: `3000 · 3001 · 4000 · 8080`(node), `5432`(Docker `booking-db`) 점유,
터널 0개. **이 포트를 피하고, 남의 프로세스·터널을 끄지 않는다.**
무료 퀵터널은 URL 이 매번 바뀌므로 재시작 시 웹훅 등록을 갱신해야 한다.

## 🔴 게이트는 훅으로 강제하고, 그 훅이 잡는지 검사한다

공개 검사는 `.githooks/pre-commit` 이 강제한다. 설치:

```bash
git config core.hooksPath .githooks
```

**"훅이 있다"와 "훅이 잡는다"는 다르다.** 실측 2026-09-09: `git diff --cached
--name-only` 가 한글 파일명을 `"docs/\352\270\260..."` 로 내놓아 `docs/*` 패턴이
안 맞았고, **`docs/기획.md` 가 그대로 커밋됐다**(원격 반영 전 발견해 되돌렸다).
`-z | tr '\0' '\n'` 로 원문 경로를 받아 고쳤다.

→ 훅·검사기를 만들거나 고치면 **실제로 위반을 만들어 막히는지 확인한다.**

```bash
node scripts/build-data.mjs && node scripts/verify-disclosure.mjs   # 데이터 검사
python3 scripts/verify-gates.py                                     # 검사기가 잡는지
```

`verify-gates.py` 는 방어를 하나씩 무력화해 검사기가 빨개지는지 본다.
이 검증이 실제로 구멍 둘을 드러냈다 — 층 배정(`checkTierAssignment`)과
게재 컷(`checkPeriodCutoff`). **M1 이 "못 잡음" 으로 나오는 것은 정상이다**
(개인 도메인 방어가 이중이라 하나만 죽이면 다른 하나가 막는다).

## 구조는 FSD 다 — 전역 규칙(`frontend-react-fsd`)을 따른다

```
app/       Next.js App Router 가 이 레이어를 겸한다. 라우트는 얇게 두고 조합만 한다
widgets/   여러 슬라이스를 조합한 화면 블록  hero · nav · page-shell
features/  서버 리소스 없이 UI·흐름만        room-3d · reveal
entities/  백엔드 엔드포인트가 있는 도메인   contact · diagnose · project · room
shared/    가장 아래. 어느 도메인에도 안 속한다
```

**entities 판정은 "재사용될까"가 아니라 "백엔드 엔드포인트가 있는가"다.**
실측: `apps/api` 의 `@Controller('contact')` · `@Controller('diagnose')`.
`project`·`room` 은 엔드포인트가 없지만 이 사이트의 도메인 모델이라 여기 둔다
(각 `index.ts` 주석에 근거를 적어놨다).

🔴 **단방향 의존 — 예외 없다.** 하위가 상위를 import 하지 않는다. type-only 도 안 된다.
🔴 **슬라이스는 `index.ts` 로만 노출한다.** 남의 슬라이스 내부 파일을 직접 부르지 않는다.
🔴 **`shared` 는 슬라이스가 아니라 세그먼트다** — `@/shared/ui`·`@/shared/lib` 로 부르고
   **통짜 `@/shared` 는 쓰지 않는다.** 실측(FLW): 통짜 사용 0건, 전부 세그먼트로 부른다
   (`@/shared/components/ui` 107건 · `@/shared/lib/utils` 75건 · `@/shared/store` 53건).
   통짜 barrel 은 무관한 모듈을 한 파일에 묶어 순환 참조를 만들기 쉽다.
🔴 **상대경로(`../`) 금지.** `@/` 절대경로만. 같은 폴더 `./` 만 예외.
   ⚠️ CSS Module 은 `index.ts` 로 재노출이 안 되므로 경로 직접 참조를 허용한다.

`node scripts/verify-fsd.mjs` 가 이 셋을 전부 검사한다(`pnpm verify` 에 포함).
되돌리기 검증 완료 — 단방향 위반·슬라이스 내부 참조 둘 다 잡는다.

## 포트

web `3200` · api `3201`. **DB 는 없다** — `apps/api` 에 DB 드라이버가 없다
(`grep -rn "prisma\|typeorm\|DATABASE_URL" apps/api/src -i` → 0건).
옛 기술에 있던 `5433` 은 지금 `wolca-postgres`(Docker) 가 쓴다.

api 가 3100 이었는데 **2026-09-16 실측에서 남이 쥐고 있어 3201 로 비켰다** —
`3100`·`3101` 을 다른 저장소의 dev 서버가 9/14 부터 점유 중이다.
포트는 고정값이 아니라 **띄우기 전에 매번 세는 것**이다. 남의 것을 끄지 않는다.
`pgrep -x cloudflared` 를 쓴다 — `ps aux | grep` 은 자기 명령줄을 세어 오답을 낸다.

## ⚠️ 모니터 토글 — 기획서 원안에서 축이 바뀌었다 (2026-09-09)

기획서 4절은 **"진행 흐름 ↔ 구조 흐름"** 이었다. 그 데이터가 정본에 없다:

```bash
cd "${PORTFOLIO_SOURCE:-$HOME/dev/data/portfolio-source}" && python3 -c "
import json,glob
n=sum('diagramSeeds' in json.load(open(f)) for f in glob.glob('projects/*.json'))
print('diagramSeeds 보유:', n, '건 (그나마 제목+참고위치뿐)')
d=json.load(open('projects/claude-board.json'))
print('decisions 키:', list(d['decisions'][0].keys()))"
# → 단계 구분도 노드 연결도 없다
```

지어내면 CLAUDE.md 위반이므로 **있는 데이터로 축을 바꿨다**:

| 축 | 데이터 | 주 독자 |
|---|---|---|
| 어떻게 판단했나 | `decisions[]` (선택·대안·이유·대가) | 발주자 |
| 무엇이 나왔나 | `metrics[]` (재현 명령 포함) | 개발자·CTO |

"한쪽만 두면 다른 쪽 방문자가 읽을 게 없다" 는 기획 의도는 그대로다.
원안으로 되돌리려면 **정본에 단계별 판단과 노드 연결을 먼저 넣어야 한다.**

🔴 두 축을 **모두 DOM 에 둔다.** 안 보이는 쪽은 `hidden` 으로 감출 뿐이다 —
한쪽만 렌더하면 서버가 내보내는 HTML 에도 한쪽만 들어가 크롤러가 수치를 놓친다.
`.panel[hidden]{display:none}` 이 필요하다(`display:flex` 가 기본값을 이긴다).

```bash
curl -s http://localhost:3200/work/claude-board | grep -c '어떻게 판단했나\|무엇이 나왔나'
```

## 작업 사이클

전역 표준을 따른다 — **이슈 → `feature/{이슈번호}-{설명}` → conventional commits(**제목은 명사형** — `~한다` 서술형 금지) → PR `Closes #N` → 리뷰 → 병합 → `/handoff`**.
(정본: `~/.claude/rules/git-workflow.md`. Codex 는 전역 규칙을 못 읽으므로 이 저장소의 값을 여기 적어 둔다.)

| | |
|---|---|
| 트래커 | GitHub Issues (`chahyunwoo/neighbor-dev`) |
| 분기 기준 | `main` |
| 승격 경로 | `feature/* → main` |
| 병합 위임 | **전부 위임** |
| 리뷰어 | 전역 `code-reviewer` + `node scripts/verify-fsd.mjs`(FSD 레이어·슬라이스 public API 를 기계로 검사한다) |
| 검증 | `.claude/verify.sh` |
| 푸시 = 배포? | **예 — `main` 푸시가 곧 Vercel 배포다.** |

🔴 **이 저장소는 PUBLIC 이다.** 커밋 한 번이 곧 공개다 — 자세한 것은 위 「공개 금지」 절.
