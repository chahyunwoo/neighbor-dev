import type { Metadata } from 'next'

const SITE_NAME = '이웃집 개발자'

/**
 * 화면 하나의 metadata. **canonical 과 openGraph 를 같이 만든다.**
 *
 * 🔴 **손으로 따로 쓰지 않는다.** 루트 layout 의 `alternates.canonical` 은
 *    하위 화면에 **상속된다** — 페이지가 자기 것을 선언하지 않으면 모든 화면이
 *    루트를 canonical 로 가리키고, 검색엔진이 하위 화면을 루트로 통합한다.
 *    실측 2026-09-17: `/work` 의 canonical 이 사이트 루트였다.
 *    openGraph 도 같다. 선언하지 않으면 공유할 때 전부 같은 제목이 뜬다.
 *    → 한 함수에서 같이 만들어 **빠뜨릴 수 없게** 한다.
 *
 * `path` 는 `/work` 처럼 슬래시로 시작하는 경로다. 절대 URL 로 바꾸는 것은
 * `metadataBase`(루트 layout)가 한다.
 */
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
      title: `${title} · ${SITE_NAME}`,
      description,
      url: path,
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      /*
       * 🔴 **이미지를 명시한다.** 페이지가 `openGraph` 를 선언하면 루트의 것을
       *    **통째로 덮어쓴다** — `opengraph-image.tsx` 가 루트에만 있으므로
       *    하위 화면은 og:image 가 사라진다. 실측 2026-09-17: 6개 화면에서
       *    이미지가 빠진 채로 나갔고, 프로브를 만들고서야 보였다.
       *    (라우트마다 이미지 파일을 두는 방법도 있지만 그림은 하나면 된다.)
       */
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: SITE_NAME }],
    },
  }
}
