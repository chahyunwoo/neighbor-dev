import { ImageResponse } from 'next/og'

/** iOS 홈 화면 아이콘. 도형은 `app/icon.svg` 와 같다. iOS 가 모서리를 직접 깎으므로 바탕은 각지게 둔다. */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0a0c',
      }}
    >
      <svg
        width="132"
        height="132"
        viewBox="0 0 64 64"
        fill="none"
        strokeLinecap="square"
        strokeLinejoin="miter"
        role="img"
        aria-label="이웃집 개발자"
      >
        <path d="M6 30 L32 9 L58 30" stroke="#e8a87c" strokeWidth="4.4" />
        <path d="M20 40 L26 46 L20 52" stroke="#e7e9ee" strokeWidth="4.4" />
        <path d="M34 52 L44 52" stroke="#e7e9ee" strokeWidth="4.4" />
      </svg>
    </div>,
    size,
  )
}
