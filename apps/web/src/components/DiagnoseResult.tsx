'use client'

import styles from './DiagnoseResult.module.css'
import { RichText } from './RichText'

/**
 * 자가진단 결과를 섹션 카드로 쪼갠다.
 *
 * 🔴 **스트리밍 중에도 쪼갠다.** 마지막 카드는 아직 쓰이는 중이라 커서가 붙는다 —
 *    "지금 이걸 쓰고 있다" 가 보여야 15초가 기다림이 아니라 과정이 된다.
 *
 * ⚠️ 마크다운 파서를 들이지 않는다. 프롬프트가 `## 제목` 형식을 고정하므로
 *    그 한 가지만 쪼개면 된다 — 파서를 넣으면 링크·이미지까지 렌더되어
 *    정본에 섞인 것이 클릭 가능한 형태로 나갈 수 있다(RichText 와 같은 판단).
 */

export interface Section {
  /** `## ` 뒤의 제목. 앞머리 숫자는 뗀다. */
  title: string
  body: string
}

/** 텍스트를 `## 제목` 단위로 쪼갠다. 제목 앞의 도입부는 버리지 않고 첫 칸에 둔다. */
export function splitSections(text: string): { intro: string; sections: Section[] } {
  const lines = text.split('\n')
  const sections: Section[] = []
  const intro: string[] = []
  let current: Section | null = null

  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m) {
      if (current) sections.push(current)
      // "1. 무엇을 만드는 것인지" → "무엇을 만드는 것인지"
      current = { title: (m[1] ?? '').replace(/^\d+\.\s*/, ''), body: '' }
      continue
    }
    if (current) current.body += `${line}\n`
    else intro.push(line)
  }
  if (current) sections.push(current)

  return {
    intro: intro.join('\n').trim(),
    sections: sections.map((s) => ({ ...s, body: s.body.trim() })),
  }
}

/**
 * 본문을 문단으로 나눈다. 빈 줄이 문단 경계다.
 * 목록(`-` 로 시작)은 줄마다 따로 둔다 — 한 덩어리로 묶으면 안 읽힌다.
 */
function toParagraphs(body: string): string[] {
  const out: string[] = []
  let buf: string[] = []
  const flush = () => {
    const joined = buf.join(' ').trim()
    if (joined) out.push(joined)
    buf = []
  }
  for (const line of body.split('\n')) {
    const t = line.trim()
    if (!t) {
      flush()
    } else if (/^[-*·]\s/.test(t)) {
      flush()
      out.push(t)
    } else {
      buf.push(t)
    }
  }
  flush()
  // 같은 문단이 두 번 나오면 key 가 겹친다. 드물지만 막아 둔다.
  return out.map((p, i) => (out.indexOf(p) === i ? p : `${p}\u200b${i}`))
}

export function DiagnoseResult({
  text,
  streaming,
}: {
  text: string
  /** 아직 쓰이는 중인가. 마지막 카드에 커서를 붙인다. */
  streaming: boolean
}) {
  const { intro, sections } = splitSections(text)

  return (
    <div className={styles.wrap}>
      {intro ? <p className={styles.intro}>{intro}</p> : null}
      {sections.map((section, i) => {
        const isLast = i === sections.length - 1
        return (
          <section key={section.title} className={styles.card} data-streaming={streaming && isLast}>
            <div className={styles.head}>
              <span className={styles.no}>{String(i + 1).padStart(2, '0')}</span>
              <h3 className={styles.title}>{section.title}</h3>
            </div>
            <div className={styles.body}>
              {/*
               * 줄 단위가 아니라 **문단 단위**로 렌더한다. 줄로 쪼개면 key 에
               * index 를 쓸 수밖에 없고(같은 줄이 반복될 수 있다), 스트리밍
               * 중에는 줄 수가 계속 바뀌어 React 가 매번 다시 그린다.
               * 문단은 내용이 유일하고 개수도 덜 흔들린다.
               */}
              {toParagraphs(section.body).map((para) => (
                <p key={para} className={styles.line}>
                  <RichText>{para}</RichText>
                </p>
              ))}
              {streaming && isLast ? <span className={styles.cursor} aria-hidden="true" /> : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
