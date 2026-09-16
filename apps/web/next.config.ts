import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  /*
   * 🔴 **`next dev` 가 `AGENTS.md`·`CLAUDE.md` 를 만드는 것을 끈다.**
   *
   *    dev 를 띄울 때마다 `apps/web/` 에 두 파일이 생기는데 `.gitignore` 에도
   *    없어서 **`git add -A` 한 번이면 그대로 커밋된다.** 이 저장소는 PUBLIC 이다.
   *
   *    게다가 커밋 `fb8957d`("정리: 안 쓰는 도구 설정과 포트폴리오 노트 차단")가
   *    루트 `AGENTS.md` 177줄을 지웠다 — **안 쓰기로 한 것이 dev 를 띄울 때마다
   *    되살아났다.** 무시 목록으로 덮는 것보다 애초에 안 만들게 하는 쪽이 맞다.
   */
  agentRules: false,
  // 3D 청크는 초기 번들에 넣지 않는다 (기획서 4절 성능 예산).
  experimental: { optimizePackageImports: ['three'] },
}

export default config
