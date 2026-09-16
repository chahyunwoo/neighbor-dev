import type { ReactNode } from 'react'

/**
 * 제목 아래의 본문.
 *
 * 🔴 **연출이 없다. 감싸기만 한다.**
 *
 *    전에는 들어올 때 떠오르게 했는데, 그 `initial` 이 `opacity: 0` 이라
 *    **View Transitions 가 새 화면을 스냅샷으로 찍는 순간(58ms) 본문이
 *    투명했다** — 겹쳐 줄 그림이 비어서 화면이 어두워졌다(실측 2026-09-16:
 *    320ms·560ms 스크린샷이 비어 있었다).
 *
 *    화면 전환의 페이드는 VT 가 GPU 에서 한다. 그 위에 또 얹으면 겹침이
 *    깨진다 — 한쪽이 투명하면 크로스페이드가 성립하지 않는다.
 *
 * ⚠️ 이 컴포넌트를 지우지 않고 남겨 둔 것은, 감싸는 자리가 곧 "화면 전환에서
 *    한 덩어리로 다뤄지는 범위" 라는 표시이기 때문이다. 나중에 VT 의
 *    `view-transition-name` 을 붙일 자리도 여기다.
 */
export function TransitionBody({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string | undefined
  as?: 'div' | 'p' | 'section'
}) {
  return <Tag className={className}>{children}</Tag>
}
