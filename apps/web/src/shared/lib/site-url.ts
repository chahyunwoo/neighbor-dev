// 도메인을 소스에 박지 않는다. NEXT_PUBLIC_ 금지 — 번들에 박혀 브라우저에 노출된다.
// localhost 폴백은 의도다 — 배포에서 변수를 빠뜨리면 눈에 띄게 틀려 점검에서 잡힌다.
export function siteUrl(): string {
  const explicit = process.env.SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  // Vercel 이 배포마다 넣어준다. 프로덕션 도메인이 먼저다.
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`

  return 'http://localhost:21200'
}

/** 경로를 절대 URL 로. `/` 로 시작하지 않으면 붙여준다. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
