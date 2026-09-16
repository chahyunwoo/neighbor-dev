import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { TransitionRoot } from '@/features/page-transition'
import { MotionRoot } from '@/features/reveal'
import { CanvasRoot, RoomProvider } from '@/features/room-3d'
import '@/shared/styles/tokens.css'

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
        {/*
         * 🔴 **JS 가 없으면 등장 연출을 통째로 무효화한다.**
         *
         *    Motion 은 `initial` 을 **서버 HTML 의 인라인 스타일**로 내보낸다
         *    (실측 2026-09-16: `<article style="opacity:0;transform:translateY(14px)">`).
         *    JS 가 켜지면 애니메이션이 그걸 풀지만, **꺼져 있으면 영영 투명한
         *    채로 남는다** — 글이 있는데 안 보이는 최악의 상태다.
         *
         *    기획서 4절의 폴백 3단(3D → 목록 → 서버 HTML)이 지켜지려면
         *    마지막 단에서 글이 읽혀야 한다.
         */}
        <noscript>
          <style
            // biome-ignore lint/security/noDangerouslySetInnerHtml: noscript 안의 정적 CSS 다
            dangerouslySetInnerHTML={{
              __html: '[style*="opacity:0"]{opacity:1!important;transform:none!important}',
            }}
          />
        </noscript>
      </head>
      <body>
        {/*
         * 🔴 `TransitionRoot` 가 `MotionRoot` **안**이다. 전환도 모션이라
         *    `reducedMotion="user"` 의 적용 범위에 들어가야 한다.
         *    (다만 **대기 시간**은 Motion 이 안 지워서 `TransitionRoot` 가
         *    직접 건너뛴다 — 그 파일 주석 참고.)
         */}
        {/*
         * 🔴 `RoomProvider` 가 `{children}` 과 `<CanvasRoot />` 를 **둘 다**
         *    감싼다. 화면이 선언한 모드를 캔버스가 읽어야 하기 때문이다.
         */}
        <RoomProvider>
          <MotionRoot>
            <TransitionRoot>{children}</TransitionRoot>
          </MotionRoot>
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
        </RoomProvider>
      </body>
    </html>
  )
}
