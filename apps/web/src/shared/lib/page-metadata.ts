import type { Metadata } from 'next'

const SITE_NAME = '이웃집 개발자'

// canonical 과 openGraph 를 같이 만든다 — 선언하지 않으면 루트 canonical 이 상속돼 하위 화면이 루트로 통합된다.
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${SITE_NAME} | ${title}`,
      description,
      url: path,
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      // 이미지를 명시한다 — 페이지 openGraph 가 루트 것을 통째로 덮어 og:image 가 사라진다.
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: SITE_NAME }],
    },
  }
}
