import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '../styles/tokens.css'

export const metadata: Metadata = {
  title: {
    default: '이웃집 개발자',
    template: '%s · 이웃집 개발자',
  },
  description:
    '웹·앱을 기획부터 배포까지 만듭니다. 화면도 서버도 직접 합니다. 만든 것과 그때 내린 판단을 그대로 보여드립니다.',
  // 🔴 개인 사이트 도메인·저장소 링크를 넣지 않는다 (기획서 7절).
  openGraph: {
    title: '이웃집 개발자',
    description: '웹·앱을 기획부터 배포까지 만듭니다. 화면도 서버도 직접 합니다.',
    type: 'website',
    locale: 'ko_KR',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#0b0a0c',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@300;400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
