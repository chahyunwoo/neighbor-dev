# 이웃집 개발자

SI·웹에이전시 회사 홈페이지. **기술 쇼케이스가 목적**이고, 수주 문의는 그 결과다.

방문자는 개발자의 작업실을 3D 로 돌아다닌다. 그 안의 물건이 전부 프로젝트로 통한다 —
모니터를 열면 프로젝트가 어떻게 굴러갔는지(진행 ↔ 구조 토글)가 보이고,
화이트보드에는 그동안 만든 것이 붙어 있다.

## 구성

```
apps/
  web/    Next.js  — 3D 쇼케이스 · 실적 · 문의  (구조는 FSD, CLAUDE.md 참고)
  api/    NestJS   — AI 자가진단 (API 키 보호)
data/
  generated/       — 빌드 타임에 만들어지는 공개 데이터 (커밋 대상)
scripts/           — 데이터 파이프라인과 공개 검사 게이트
  probes/          — 브라우저 프로브. 정적 검사가 못 잡는 것을 잡는다
TODO.md            — 남은 일
```

## 검증

```bash
pnpm verify   # lint · typecheck · test · FSD · 방 검사 · 공개 데이터 검사
pnpm probe    # 브라우저 프로브 11종 (api·web 이 떠 있어야 한다)
```

🔴 **`pnpm verify` 가 초록이어도 화면이 깨져 있을 수 있다.** 실제로 여러 번
그랬다 — 3D 가 본문을 덮거나, 모바일에서 목록이 잘리거나, 카피가 3초 뒤에
뜨거나. 전부 정적 검사는 통과한 상태였다. 그래서 `pnpm probe` 가 따로 있다.

```bash
# 프로브를 돌리려면 둘 다 떠 있어야 한다
pnpm --filter @neighbor/api build && node apps/api/dist/main.js &
pnpm --filter @neighbor/web build && pnpm --filter @neighbor/web start &
pnpm probe
```

⚠️ 처음이면 브라우저를 받아야 한다: `pnpm exec playwright install chromium`

**판정을 사람이 해야 하는 것도 있다** — `scripts/probes/verify-each-object.cjs`
는 물건 7개를 촬영만 한다. "방이 보이는가" 는 자동 지표가 없어서(마커 수는 늘
7/7 이고 캔버스 밝기는 WebGL 이라 못 읽는다) **스크린샷을 열어서 본다.**

## 다른 환경으로 옮길 때

`.gitignore` 때문에 **따라오지 않는 것들**이 있다:

| 대상 | 내용 | 어떻게 |
|---|---|---|
| `docs/기획.md` | 기획 확정본 | 개인 도메인이 있어 의도적으로 제외. 로컬에서 직접 옮긴다 |
| `.env.local` | API 키·SMTP·DB | `.env.example` 을 보고 새로 채운다 |
| `.wip/` | 옛 조사 스크립트 | 쓸 것은 `scripts/probes/` 로 이미 옮겼다 |

`docs/기획.md` 가 없으면 **왜 그렇게 만들었는지의 근거가 사라진다.** 먼저 챙긴다.

## 데이터 파이프라인

프로젝트 데이터는 **런타임 DB 가 아니라 빌드 타임 정적 생성**이다.
정본은 별도 PRIVATE 저장소(`portfolio-source`)에 있고, 여기에는 걸러진 결과만 들어온다.

```bash
pnpm data           # 정본 → data/generated/projects.json
pnpm data:verify    # 공개 검사 (한 건이라도 걸리면 exit 1)
```

기획서 11절의 두 층으로 나뉜다:

| 층 | 대상 | 표기 수준 |
|---|---|---|
| 사례 상세 | 10건 | 문제·판단·수치까지 |
| 경력 요약 | 6건 | 도메인 + 기간 + 스택까지만 |
| 게재 제외 | 1건 | 싣지 않는다 |

**판정은 `scripts/tiers.mjs` 한 곳에서만 한다.** 호출부가 `clientSafe` 를 직접 보고
분기하지 않는다 — 지난 세션에 층 규칙을 어겨 공개 사이트에 실은 사고가 있었고,
공개 저장소·상시 공개라 회수가 되지 않는다.

## 게이트가 작동하는지 검사한다

검사기가 있다는 것과 검사기가 잡는다는 것은 다르다. 뮤테이션으로 확인한다:

```bash
python3 scripts/verify-gates.py
```

방어를 하나씩 일부러 무력화하고 검사기가 빨개지는지 본다.
실제로 이 스크립트가 검사기의 구멍 둘을 드러냈다(층 배정·게재 컷).

## 개발

```bash
pnpm install
pnpm dev
```

⚠️ 이 맥은 여러 프로젝트가 포트와 `cloudflared` 를 나눠 쓴다.
띄우기 **전에** 매번 센다 — "아마 비어 있을 것"을 사실로 받아들이지 않는다.

```bash
lsof -nP -iTCP -sTCP:LISTEN
docker ps --format '{{.Names}}\t{{.Ports}}'
pgrep -x cloudflared        # ⚠️ `ps aux | grep` 은 자기 명령줄을 세어 오답을 낸다
```

2026-09-09 실측 기준 `80·443·2019`(caddy) · `3000·3001·3002·4000·5173·8080`(node) ·
`7777·8090`(java) · `5432`(Docker) 가 점유 중이다.
**이 저장소는 web 3200 · api 3100 · DB 5433 을 쓴다.** 남의 프로세스·터널을 끄지 않는다.

## 라이선스

미정.
