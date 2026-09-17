import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/shared/lib'

/**
 * robots.txt — Next 가 `/robots.txt` 로 내보낸다.
 *
 * 🔴 `/api/*` 를 막는다. 프록시용 Route Handler 라 색인될 내용이 없고,
 *    크롤러가 POST 전용 엔드포인트를 두드리면 쿼터만 깎인다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
