import type { ReactNode } from 'react'
import styles from './RichText.module.css'

// 정본의 굵게·코드 표기만 렌더한다. 마크다운 라이브러리를 쓰지 않는다 — 링크가 클릭 가능한 형태로 나가지 않게.
export function RichText({ children }: { children: string }) {
  return <>{parseInline(children)}</>
}

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
