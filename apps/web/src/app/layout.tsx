import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { CanvasRoot } from '../components/canvas/CanvasRoot'
import { MotionRoot } from '../components/MotionRoot'
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
      <body>
        <MotionRoot>{children}</MotionRoot>
        {/*
         * 지속 캔버스 — 앱 전체에 하나. 라우트가 바뀌어도 살아 있다.
         *
         * 🔴 **`{children}` 밖에 둔다.** 안에 두면 `template.tsx` 의 전환
         *    `transform` 이 `position:fixed` 의 기준을 바꿔, 라우트 전환
         *    동안 캔버스가 같이 흔들린다.
         *
         * 🔴 **`children` 뒤에 둔다** — 히어로 텍스트가 먼저 파싱되어야 한다
         *    (LCP 요소를 3D 로 만들지 않는다).
         *
         * 🔴 `MotionRoot` 밖이다. `MotionConfig` 는 DOM 모션 설정이고
         *    R3F 의 `useFrame` 루프는 별개다.
         */}
        <CanvasRoot />
      </body>
    </html>
  )
}
