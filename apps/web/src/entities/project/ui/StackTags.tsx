'use client'

import { useId, useState } from 'react'
import styles from './StackTags.module.css'

interface Props {
  /** 이미 `displayStack()` 을 거친 기술명 목록. */
  names: string[]
  /** 접혔을 때 몇 개까지 보일지. 나머지는 펼쳐야 보인다. */
  peek?: number
  /** 펼침 버튼에 읽힐 대상 이름 — 한 화면에 여러 개가 있으므로 구분한다. */
  label: string
}

// 버리지 않고 접는다. 접힌 것도 DOM 에 둔다 — 조건부로 렌더하면 크롤러가 놓친다.
export function StackTags({ names, peek = 3, label }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()

  if (names.length === 0) return null

  const head = names.slice(0, peek)
  const rest = names.slice(peek)

  return (
    <div className={styles.wrap}>
      <div className={styles.tags}>
        {head.map((s) => (
          <span key={s} className={styles.tag}>
            {s}
          </span>
        ))}

        {/* 나머지는 항상 렌더하고 hidden 으로만 감춘다. */}
        <span className={styles.rest} id={id} hidden={!open}>
          {rest.map((s) => (
            <span key={s} className={styles.tag}>
              {s}
            </span>
          ))}
        </span>

        {rest.length > 0 ? (
          <button
            type="button"
            className={styles.more}
            aria-expanded={open}
            aria-controls={id}
            // 대상 이름은 aria-label 로만 준다 — 화면 텍스트로 두면 제목이 한 번 더 깔린다.
            aria-label={`${open ? '기술 접기' : `기술 ${rest.length}개 더 보기`} — ${label}`}
            onClick={(e) => {
              // 카드 전체가 링크인 자리에서도 쓴다 — 펼치려다 이동하면 안 된다.
              e.preventDefault()
              e.stopPropagation()
              setOpen((v) => !v)
            }}
          >
            {open ? '기술 접기' : `기술 ${rest.length}개 더`}
          </button>
        ) : null}
      </div>
    </div>
  )
}
