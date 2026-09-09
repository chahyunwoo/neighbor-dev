/** 로고 A안(처마) — 시안 Logo.dc.html 확정본. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      strokeLinecap="square"
      strokeLinejoin="miter"
      role="img"
      aria-label="이웃집 개발자"
    >
      <title>이웃집 개발자</title>
      {/* 처마 — 집 */}
      <path d="M6 30 L32 9 L58 30" stroke="var(--amber)" strokeWidth="4.4" />
      {/* 프롬프트 — 개발자 */}
      <path d="M20 40 L26 46 L20 52" stroke="var(--fg)" strokeWidth="4.4" />
      <path d="M34 52 L44 52" stroke="var(--fg)" strokeWidth="4.4" />
    </svg>
  )
}
