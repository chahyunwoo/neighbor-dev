#!/bin/bash
# api 를 두는 기기에서 실행한다. origin/main 으로 맞춘 뒤 api 를 다시 빌드·재시작하고, 헬스 체크가 실패하면 직전 커밋으로 되돌린다.
# 배포 키는 authorized_keys 의 command= 로 묶어 저장소 안에서 `bash <(git show origin/main:scripts/deploy-api.sh)` 만 돌린다.
# 늘 main 의 최신 스크립트가 돌도록 파일 경로가 아니라 저장소 기준으로 움직인다.
# 비대화형 ssh 는 셸 설정을 안 읽어 nvm 의 node 가 PATH 에 없다. nvm 은 set -u 아래에서 죽으므로 먼저 부른다
# shellcheck disable=SC1091
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null
export PATH="/opt/homebrew/bin:$PATH"
set -uo pipefail

LABEL=com.chahyunwoo.neighbor-api
ROOT="$(git rev-parse --show-toplevel)" || exit 1

log() { echo "$(date '+%F %T') $*"; }

cd "$ROOT" || exit 1
git fetch -q origin main || { log "fetch 실패"; exit 1; }
prev=$(git rev-parse HEAD)
next=$(git rev-parse origin/main)
git merge -q --ff-only origin/main || { log "fast-forward 불가 — 작업 트리를 확인해야 한다"; exit 1; }

if [ "$prev" != "$next" ] && ! git diff --name-only "$prev" "$next" |
  grep -qE '^(apps/api/|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)'; then
  log "${next:0:7} api 변경 없음 — 재시작 생략"
  exit 0
fi

port=$(grep -E '^API_PORT=' apps/api/.env.local 2>/dev/null | cut -d= -f2)
build_and_restart() {
  corepack pnpm install --frozen-lockfile >/dev/null &&
    corepack pnpm --filter @neighbor/api build >/dev/null &&
    launchctl kickstart -k "gui/$(id -u)/$LABEL" || return 1
  for _ in $(seq 1 15); do
    curl -fsS "http://127.0.0.1:${port:-3201}/health" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

if build_and_restart; then
  log "${prev:0:7} → ${next:0:7} 배포 완료"
  exit 0
fi

log "${next:0:7} 배포 실패 — ${prev:0:7} 로 복구"
git reset -q --hard "$prev"
if build_and_restart; then
  log "복구 완료"
else
  log "복구도 실패 — 직접 확인해야 한다"
fi
exit 1
