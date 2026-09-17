/**
 * 사이트의 절대 주소. `metadataBase`·sitemap·robots·JSON-LD 가 전부 이걸 쓴다.
 *
 * 🔴 **도메인을 소스에 박지 않는다.** 이 저장소는 PUBLIC 이고 배포처가 아직
 *    확정되지 않았다. 환경변수로 받고, 없으면 Vercel 이 주는 값을 쓴다.
 *
 * 🔴 **`NEXT_PUBLIC_` 을 쓰지 않는다.** 붙이면 번들에 박혀 브라우저로 나간다.
 *    이 값들은 전부 서버에서만 쓰인다(metadata·sitemap·robots 는 서버 생성).
 *
 * ⚠️ 폴백이 `localhost` 인 것은 **의도다.** 배포 환경에서 변수를 빠뜨리면
 *    canonical·og:url 에 localhost 가 박히는데, 그건 조용히 틀린 값이 나가는
 *    것보다 **눈에 띄게 틀려서** 배포 후 점검에서 바로 잡힌다.
 *    (`scripts/verify-rendered.mjs` 가 원격 검사에서 이걸 본다.)
 */
export function siteUrl(): string {
  const explicit = process.env.SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  // Vercel 이 배포마다 넣어준다. 프로덕션 도메인이 먼저다.
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`

  return 'http://localhost:3200'
}

/** 경로를 절대 URL 로. `/` 로 시작하지 않으면 붙여준다. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
