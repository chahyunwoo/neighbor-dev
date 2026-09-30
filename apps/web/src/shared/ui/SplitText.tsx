'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { EASE } from '@/shared/lib'

// 서버에서는 쪼개지 않는다(크롤러가 파편을 읽는다). 폰트 로드 뒤 단어→글자로 쪼개고, 움직임을 끈 사람에겐 쪼개지 않는다.

// opacity 를 건드리지 않는다 — 서버가 이미 보여준 글자(대개 LCP)를 도로 감추게 된다. 나가는 연출은 View Transitions 몫.
const glyph = {
  // 보이기는 한다 — 아래에서 초점이 안 맞은 채 대기.
  hidden: { y: '0.36em', filter: 'blur(6px)' },
  show: { y: '0em', filter: 'blur(0px)' },
}

export function SplitText({
  text,
  className,
  as = 'span',
  animate = true,
  delay = 0,
  /** 글자 전체가 움직이는 총 시간(초). 간격을 고정하면 긴 제목이 끝없이 느려진다. */
  span = 0.3,
  /** 글자가 적을 때의 간격 상한. */
  maxStep = 0.045,
  duration = 0.46,
}: {
  text: string
  // exactOptionalPropertyTypes 때문에 `| undefined` 를 명시한다.
  className?: string | undefined
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p'
  /** false 면 원문을 그대로 둔다 — 라우트 전환 화면에서 VT 가 찍을 그림이 비지 않게. */
  animate?: boolean
  delay?: number
  span?: number
  maxStep?: number
  duration?: number
}) {
  // 서버 렌더와 첫 클라이언트 렌더가 같아야 하므로 폰트 준비 전까지 원문 그대로 둔다.
  const [ready, setReady] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!animate) return
    let alive = true
    const go = () => {
      if (alive) setReady(true)
    }
    // fonts API 가 없는 환경(구형·일부 테스트 런너)에서도 글은 나와야 한다.
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(go, go)
    } else {
      go()
    }
    return () => {
      alive = false
    }
  }, [animate])

  const Tag = motion[as]

  if (!animate || !ready || reduced) {
    // 쪼개기 전. 움직이지 않고 그냥 보인다 — 폰트를 기다리는 동안 글이 사라지면 안 된다.
    return <Tag className={className}>{text}</Tag>
  }

  const words = text.split(/(\s+)/)
  // 지연을 직접 계산하려면 단어 경계를 넘는 전역 순번이 필요하다.
  const total = Array.from(text.replace(/\s+/g, '')).length
  const step = total > 1 ? Math.min(maxStep, span / (total - 1)) : 0
  let seq = 0
  let key = 0

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word) => {
        if (/^\s+$/.test(word)) {
          // 공백은 쪼개지 않는다. 줄바꿈 기회는 여기서만 생긴다.
          return (
            <span key={`s${key++}`} aria-hidden="true">
              {word}
            </span>
          )
        }
        return (
          // 단어는 통째로 묶어 줄바꿈이 글자 중간에서 일어나지 않게 한다.
          <span key={`w${key++}`} aria-hidden="true" style={{ whiteSpace: 'nowrap' }}>
            {Array.from(word).map((ch) => {
              const i = seq++
              // staggerChildren 을 쓰지 않는다 — 단어 래퍼가 일반 span 이라 순서가 글자까지 안 내려온다.
              const d = delay + i * step
              return (
                // 낱글자는 같은 글자가 여러 번 나와 값으로 구별할 수 없고, 순서도 안 바뀐다.
                <motion.span
                  key={i}
                  initial={glyph.hidden}
                  animate={glyph.show}
                  transition={{ duration, delay: d, ease: EASE }}
                  style={{ display: 'inline-block', willChange: 'transform, filter, opacity' }}
                >
                  {ch}
                </motion.span>
              )
            })}
          </span>
        )
      })}
    </Tag>
  )
}
