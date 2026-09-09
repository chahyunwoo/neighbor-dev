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

/**
 * 쓴 기술 — **접어 둔다.**
 *
 * 🔴 이 사이트를 보러 오는 사람은 개발자가 아니라 **웹 수주를 맡기려는
 *    클라이언트**다(기획서 1절). 그런데 스택 태그가 카드 앞면을 덮고 있어서
 *    화면 기술용어 98개 중 **67개가 이 태그**였다(2026-09-09 실측, 이슈 #2).
 *
 * 🔴 **버리지 않고 접는다.** 기획서 4절이 "한쪽만 두면 다른 쪽 방문자가 읽을
 *    게 없다" 고 했다 — 개발자·CTO 는 이걸 보러 온다. 없애면 그 사람들이
 *    읽을 것이 사라진다.
 *
 * 🔴 **접힌 것도 DOM 에 둔다.** `ProjectLens` 와 같은 이유다 — 클라이언트에서
 *    조건부로 렌더하면 서버가 내보내는 HTML 에 안 들어가고 크롤러가 놓친다.
 *    감추는 것은 `hidden` 속성뿐이다. (CSS 쪽 사정은 모듈 주석 참고 —
 *    `ProjectLens` 와 달리 여기선 `[hidden]` 기본값이 그대로 이긴다.)
 */
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

        {/* 나머지는 항상 렌더하고 접힘 상태에서만 감춘다 — 위 주석의 이유. */}
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
            /*
             * 🔴 대상 이름은 **`aria-label` 로만** 준다. 화면 텍스트로 두면
             *    (`.srOnly` 로 감춰도) 프로젝트 제목이 한 번 더 깔려서
             *    기술용어가 도로 늘어난다 — 실측으로 3개가 그렇게 늘었다.
             */
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
