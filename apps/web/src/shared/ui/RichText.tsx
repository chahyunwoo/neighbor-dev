import type { ReactNode } from 'react'
import styles from './RichText.module.css'

/**
 * 정본(portfolio-source)의 인라인 마크다운을 렌더한다.
 *
 * 정본은 사람이 읽고 쓰는 노트라 `**굵게**` 와 `` `코드` `` 를 쓴다.
 * 데이터 단계에서 이 표기를 **지우지 않는다** — 지우면 강조 의도가 사라지고,
 * 남겨두면 화면에 별표가 그대로 보인다(실측 2026-09-09). 그래서 여기서 렌더한다.
 *
 * 🔴 마크다운 라이브러리를 쓰지 않는다. 링크·이미지·HTML 을 지원하지 않는
 *    것이 이 컴포넌트의 요지다 — 정본에 링크가 섞여 들어와도 이 화면에서는
 *    글자로만 나가므로, 개인 도메인·저장소 링크가 클릭 가능한 형태가 되지 않는다.
 *    (기획서 7절: 우리가 먼저 링크를 뿌리지 않는다.)
 */
export function RichText({ children }: { children: string }) {
  return <>{parseInline(children)}</>
}

/** `**굵게**` 와 `` `코드` `` 만 처리한다. 나머지는 글자 그대로 둔다. */
function parseInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  // 백틱을 먼저 잡는다 — 코드 안의 별표를 강조로 읽지 않기 위해서다.
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let last = 0
  let key = 0
  for (const m of text.matchAll(re)) {
    const at = m.index
    if (at > last) out.push(text.slice(last, at))
    if (m[1] !== undefined) {
      out.push(
        <code key={key++} className={styles.code}>
          {m[1]}
        </code>,
      )
    } else if (m[2] !== undefined) {
      out.push(
        <strong key={key++} className={styles.strong}>
          {m[2]}
        </strong>,
      )
    }
    last = at + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
