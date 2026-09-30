import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/shared/lib'

// /api/* 를 막는다 — 프록시라 색인할 것이 없고 POST 엔드포인트를 두드리면 쿼터만 깎인다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
