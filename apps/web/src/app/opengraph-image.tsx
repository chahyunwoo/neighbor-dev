import { ImageResponse } from 'next/og'

/**
 * 공유 썸네일 — 카톡·슬랙·트위터에 링크를 붙였을 때 뜨는 그림.
 *
 * 🔴 **이미지 파일을 커밋하지 않는다.** PNG 를 저장소에 두면 문구를 고칠 때마다
 *    다시 그려 넣어야 하고, 그림 안 글자가 코드와 갈린다. 여기서 그리면
 *    문구가 소스에 남아 검색·검사 대상이 된다.
 *
 * 🔴 **클라이언트사명·개인 도메인을 그리지 않는다.** 그림 안 글자도 공개물이고,
 *    이미지라서 `verify-rendered` 의 텍스트 검사에 안 걸린다 — 여기 쓰는 문구는
 *    사람이 판단해서 넣는다. 지금은 사이트 이름과 한 줄 소개뿐이다.
 *
 * 색은 `shared/styles/tokens.css` 와 맞춘다(bg #0b0a0c · amber #e8a87c).
 * ⚠️ CSS 변수는 여기서 못 쓴다 — Satori 는 계산된 스타일만 받는다.
 */
export const alt = '이웃집 개발자 — 웹·앱을 기획부터 배포까지'
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
        // 램프 빛 — 사이트의 주 동선 표시와 같은 색
        backgroundImage:
          'radial-gradient(900px 500px at 78% 18%, rgba(232,168,124,0.18), transparent 70%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
        <div style={{ width: 12, height: 12, borderRadius: 999, background: '#e8a87c' }} />
        <div style={{ fontSize: 30, color: '#a8aeba', letterSpacing: 2 }}>이웃집 개발자</div>
      </div>

      <div style={{ fontSize: 76, color: '#f2f4f8', lineHeight: 1.25, fontWeight: 600 }}>
        웹·앱을 기획부터
      </div>
      <div style={{ fontSize: 76, color: '#f2f4f8', lineHeight: 1.25, fontWeight: 600 }}>
        배포까지 만듭니다
      </div>

      <div style={{ fontSize: 32, color: '#8891a0', marginTop: 40 }}>화면도 서버도 직접 합니다</div>

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
        만든 것과 그때 내린 판단을 그대로 보여드립니다
      </div>
    </div>,
    size,
  )
}
