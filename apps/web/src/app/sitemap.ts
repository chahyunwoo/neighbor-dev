import type { MetadataRoute } from 'next'
import { getDetailProjects } from '@/entities/project'
import { absoluteUrl } from '@/shared/lib'

/**
 * sitemap.xml — Next 가 `/sitemap.xml` 로 내보낸다.
 *
 * 🔴 **라우트를 손으로 나열한다.** 파일 시스템을 훑어 자동 생성하면 나중에
 *    `noindex` 로 둘 화면이 생겼을 때 조용히 섞인다. 늘어나면 여기 적는다.
 *
 * ⚠️ 상세 화면은 `getDetailProjects()` 에서 받는다 — 게재 대상만 들어 있고
 *    id 는 이미 공개용으로 바뀐 것이다(`publicIdFor`). 저장소명이 아니다.
 */
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
    ...getDetailProjects().map((p) => page(`/work/${p.id}`, 0.7)),
  ]
}
