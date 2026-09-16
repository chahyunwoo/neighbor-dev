/**
 * 화면의 제목.
 *
 * 🔴 **낱글자 연출을 뺐다.** 글자가 아래에서 하나씩 착지하게 했는데, 그
 *    `initial` 이 `opacity: 0` 이라 **View Transitions 가 새 화면을 찍는
 *    순간(58ms) 제목이 투명했다.** 겹쳐 줄 그림이 비면 크로스페이드가
 *    성립하지 않고 그냥 화면이 어두워진다(실측 2026-09-16).
 *
 *    화면 사이를 잇는 일은 VT 가 GPU 에서 한다. 그 위에 진입 연출을 또
 *    얹으면 서로를 깨뜨린다 — 하나가 맡아야 한다.
 *
 * ⚠️ `SplitText`(`shared/ui`)는 남겨 뒀다. 라우트 전환이 아니라 **처음
 *    들어올 때**(VT 가 없는 상황) 쓸 자리가 있다.
 */
export function TransitionTitle({
  text,
  className,
  as: Tag = 'h1',
}: {
  text: string
  className?: string | undefined
  as?: 'h1' | 'h2' | 'p' | 'span'
  /** @deprecated 연출이 없어져 의미가 없다. 호출부 정리 전까지 받아만 둔다. */
  delayMs?: number
}) {
  return <Tag className={className}>{text}</Tag>
}
