#!/bin/bash
# api 를 두는 기기에서 실행한다. 요청받은 커밋으로 맞춘 뒤 api 를 다시 빌드·재시작하고, 헬스 체크가 실패하면 직전 배포로 되돌린다.
# 배포 키는 authorized_keys 의 command= 로 묶여 저장소 안에서 main 의 이 스크립트만 돌린다. 인자는 SSH_ORIGINAL_COMMAND 의 커밋 SHA 하나.

# 비대화형 ssh 는 셸 설정을 안 읽어 nvm 의 node 가 PATH 에 없다. nvm 은 set -u 아래에서 죽으므로 먼저 부른다
# shellcheck disable=SC1091
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
export PATH="$PATH:/opt/homebrew/bin"
set -uo pipefail

LABEL=com.chahyunwoo.neighbor-api
STATE="$HOME/.neighbor-deploy"
LOG="$HOME/Library/Logs/neighbor-deploy.log"
mkdir -p "$STATE"

# 공개 저장소의 Actions 로그로는 요약 한 줄만 내보낸다. 도구 출력(경로·uid 가 섞인다)은 서버 로그 파일로만 간다
exec 3>&1 >>"$LOG" 2>&1
say() {
  echo "$(date '+%F %T') $*"
  echo "$*" >&3
}

want="${SSH_ORIGINAL_COMMAND:-}"
[[ "$want" =~ ^[0-9a-f]{40}$ ]] || { say "커밋 SHA 가 없거나 형식이 틀림"; exit 1; }

cd "$(git rev-parse --show-toplevel)" || exit 1
git fetch -q origin main || { say "fetch 실패"; exit 1; }
next=$(git rev-parse origin/main)
# 뒤에 더 새 커밋이 올라왔으면 그 커밋의 배포 잡이 맡는다
[ "$want" = "$next" ] || { say "${want:0:7} 은 main 최신이 아님 — 건너뜀"; exit 0; }

# 기준은 git HEAD 가 아니라 마지막으로 성공한 배포다 — 중간에 끊긴 배포가 HEAD 만 옮겨 둔 채 굳지 않게
prev=$(cat "$STATE/deployed" 2>/dev/null || git rev-parse HEAD)
git merge -q --ff-only origin/main || { say "fast-forward 불가 — 작업 트리를 확인해야 한다"; exit 1; }

port=$(sed -nE "s/^API_PORT=[\"']?([0-9]+).*/\1/p" apps/api/.env.local 2>/dev/null | head -1)
healthy() {
  for _ in $(seq 1 15); do
    curl -fsS "http://127.0.0.1:${port:-3201}/health" >/dev/null && return 0
    sleep 1
  done
  return 1
}
build_and_restart() {
  corepack pnpm install --frozen-lockfile &&
    corepack pnpm --filter @neighbor/api build &&
    launchctl kickstart -k "gui/$(id -u)/$LABEL" &&
    healthy
}

changed=$(git diff --name-only "$prev" "$next" | grep -cE '^(apps/api/|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)')
if [ "$prev" != "$next" ] && [ "$changed" -eq 0 ] && healthy; then
  echo "$next" >"$STATE/deployed"
  say "${next:0:7} api 변경 없음 — 재시작 생략"
  exit 0
fi

if build_and_restart; then
  echo "$next" >"$STATE/deployed"
  say "${prev:0:7} → ${next:0:7} 배포 완료"
  exit 0
fi

say "${next:0:7} 배포 실패 — ${prev:0:7} 로 복구"
git reset -q --hard "$prev"
if build_and_restart; then
  say "복구 완료"
else
  say "복구도 실패 — 직접 확인해야 한다"
fi
exit 1
