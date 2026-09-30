import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono } from 'next/font/google'
import type { ReactNode } from 'react'
import { TransitionRoot } from '@/features/page-transition'
import { MotionRoot } from '@/features/reveal'
import { CanvasRoot, RoomProvider } from '@/features/room-3d'
import { siteUrl } from '@/shared/lib'
import { JsonLd } from '@/shared/ui'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '@/shared/styles/tokens.css'

const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  // metadataBase 가 없으면 canonical·og:url 이 경고 없이 빠진다.
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: '/' },
  title: {
    default: '이웃집 개발자',
    template: '이웃집 개발자 | %s',
  },
  description:
    '웹·앱 기획부터 설계, 개발, 배포까지 맡는 4인 개발팀입니다. 수행 사례의 설계 판단과 결과 지표를 공개합니다.',
  // 개인 사이트 도메인·저장소 링크를 넣지 않는다.
  openGraph: {
    title: '이웃집 개발자',
    description: '웹·앱 기획부터 설계, 개발, 배포까지 맡는 4인 개발팀입니다.',
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    siteName: '이웃집 개발자',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#0b0a0c',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={plexMono.variable}>
      <head>
        {/* JS 가 없으면 등장 연출을 무효화한다 — Motion 의 initial 이 서버 HTML 에 opacity:0 으로 실린다. */}
        <noscript>
          <style
            // biome-ignore lint/security/noDangerouslySetInnerHtml: noscript 안의 정적 CSS 다
            dangerouslySetInnerHTML={{
              // 두 번째 줄은 CSS 로 접힌 방 목록을 편다 — JS 가 없으면 3D 도 안 와 목록이 유일한 길이다.
              __html:
                '[style*="opacity:0"]{opacity:1!important;transform:none!important}' +
                '[data-mode]{position:static!important;width:auto!important;height:auto!important;clip-path:none!important;overflow:visible!important;white-space:normal!important}',
            }}
          />
        </noscript>
      </head>
      <body>
        {/* TransitionRoot 는 MotionRoot 안이다 — reducedMotion 범위에 들어가야 한다. transform 만 지우니 지연은 각 연출이 지운다. */}
        {/* 사명·개인 도메인·저장소 링크를 넣지 않는다. sameAs 를 비운 것은 방침이다. */}
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            name: '이웃집 개발자',
            url: siteUrl(),
            description: '웹·앱 기획부터 설계, 개발, 배포까지 맡는 4인 개발팀입니다.',
            areaServed: 'KR',
            knowsLanguage: ['ko'],
            serviceType: ['웹 개발', '앱 개발', '백엔드 개발', '시스템 구축'],
          }}
        />
        <RoomProvider>
          <MotionRoot>
            <TransitionRoot>{children}</TransitionRoot>
          </MotionRoot>
          {/* children 밖·뒤에 둔다 — 전환 transform 에 흔들리지 않고 LCP 가 3D 가 되지 않게. */}
          <CanvasRoot />
        </RoomProvider>
      </body>
    </html>
  )
}
