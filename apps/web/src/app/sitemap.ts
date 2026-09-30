import type { MetadataRoute } from 'next'
import { getDetailProjects } from '@/entities/project'
import { absoluteUrl } from '@/shared/lib'

// 라우트를 손으로 나열한다 — 자동 생성하면 noindex 화면이 조용히 섞인다. 상세 id 는 공개용 id 다.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: 'monthly',
    priority,
  })

  return [
    page('/', 1),
    page('/work', 0.9),
    page('/contact', 0.8),
    page('/team', 0.7),
    page('/career', 0.6),
    page('/stack', 0.6),
    page('/diagnose', 0.5),
    page('/privacy', 0.2),
    ...getDetailProjects().map((p) => page(`/work/${p.id}`, 0.7)),
  ]
}
