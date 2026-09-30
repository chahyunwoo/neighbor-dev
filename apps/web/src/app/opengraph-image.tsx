import { ImageResponse } from 'next/og'

// 클라이언트사명·개인 도메인을 그리지 않는다 — 이미지는 텍스트 검사에 안 걸린다. Satori 는 CSS 변수를 못 읽어 색을 직접 쓴다.
export const alt = '이웃집 개발자 | 웹·앱 기획부터 배포까지'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 88px',
        background: '#0b0a0c',
        // 램프 빛
        backgroundImage:
          'radial-gradient(900px 500px at 78% 18%, rgba(232,168,124,0.18), transparent 70%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
        <div style={{ width: 12, height: 12, borderRadius: 999, background: '#e8a87c' }} />
        <div style={{ fontSize: 30, color: '#a8aeba', letterSpacing: 2 }}>이웃집 개발자</div>
      </div>

      <div style={{ fontSize: 76, color: '#f2f4f8', lineHeight: 1.25, fontWeight: 600 }}>
        기획부터 배포까지,
      </div>
      <div style={{ fontSize: 76, color: '#f2f4f8', lineHeight: 1.25, fontWeight: 600 }}>
        한 팀이 만듭니다
      </div>

      <div style={{ fontSize: 32, color: '#8891a0', marginTop: 40 }}>
        웹 서비스 · 관리자 시스템 · 앱
      </div>

      <div
        style={{
          display: 'flex',
          marginTop: 'auto',
          fontSize: 26,
          color: '#6c7480',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 28,
        }}
      >
        수행 사례의 설계 판단과 결과 지표를 공개합니다
      </div>
    </div>,
    size,
  )
}
