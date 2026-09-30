import type { ReactNode } from 'react'

// 연출 없이 감싸기만 한다 — opacity:0 에서 시작하면 VT 스냅샷 순간 본문이 비어 크로스페이드가 깨진다.
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
