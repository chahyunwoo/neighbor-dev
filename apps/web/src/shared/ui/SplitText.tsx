'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { EASE } from '@/shared/lib'

/**
 * 글자를 낱개로 쪼개 하나씩 움직이게 한다.
 *
 * 🔴 **서버에서는 쪼개지 않는다.** 원문을 그대로 한 덩어리로 렌더하고,
 *    하이드레이션 후에만 낱글자로 바꾼다. 서버 HTML 에 `<span>글</span>` 이
 *    줄줄이 실리면 크롤러가 읽는 것이 글이 아니라 파편이 된다
 *    (이 사이트는 수주 문의가 목적이라 검색 노출이 곧 성과다).
 *
 * 🔴 **폰트가 로드되기 전에 쪼개면 폭이 틀어진다.** 한글은 대체 폰트와 자폭
 *    차이가 커서, 쪼갠 뒤 폰트가 바뀌면 글자가 서로 겹치거나 벌어진다.
 *    `document.fonts.ready` 를 기다린다.
 *
 * 🔴 **접근성**: 부모가 `aria-label` 로 원문을 들고, 낱글자는 전부
 *    `aria-hidden` 이다. 안 그러면 스크린리더가 "들 어 와 서" 로 읽는다.
 *
 * ⚠️ 단어 단위로 먼저 나누고 그 안에서 글자를 쪼갠다. 낱글자를 그냥 늘어놓으면
 *    **줄바꿈이 단어 중간에서** 일어난다.
 *
 * ⚠️ `Array.from` 으로 쪼갠다. `split('')` 은 서로게이트 페어(이모지 등)를
 *    반쪽으로 자른다.
 *
 * 🔴 **움직임을 끈 사람에게는 아예 쪼개지 않는다.**
 *    `MotionRoot` 의 `reducedMotion="user"` 는 **`transform` 만** 지운다 —
 *    `filter: blur` 와 `delay` 는 그대로 남아서, 위치는 안 움직이는데 글자가
 *    흐린 채로 대기하다 초점이 맞는 연출이 된다. 지우려던 것이 안 지워진다.
 *    → `useReducedMotion()` 으로 여기서 직접 판단하고 원문을 그대로 둔다.
 */

/**
 * 낱글자 하나의 움직임.
 *
 * 🔴 **`opacity` 를 건드리지 않는다. 이게 핵심이다.**
 *
 *    전에는 `opacity: 0` 에서 출발했다. 그런데 이 컴포넌트는 **서버에서 원문을
 *    그대로 렌더한 뒤** 클라이언트에서 낱글자로 갈아끼운다 — 즉 갈아끼우는
 *    순간 **이미 읽히고 있던 글자를 도로 감추게 된다.** 화면에서 제일 큰
 *    글자가 구멍이 되고, 그게 대개 LCP 요소다. 검색 유입이 곧 수주 경로인
 *    사이트에서 제목을 JS 뒤로 미루는 셈이다.
 *
 *    → 이동(`y`)과 초점(`blur`)만 움직인다. 잉크는 처음부터 끝까지 화면에
 *      있고, "아래에서 올라오며 초점이 맞는다" 는 연출은 그대로 읽힌다.
 *
 * 🔴 **나가는 상태가 없다.** 화면을 떠나는 연출은 View Transitions 가 이전
 *    화면을 통째로 겹쳐 빼는 것으로 처리한다(`TransitionRoot`). 여기서 또
 *    흩뜨리면 같은 것이 두 번 움직인다.
 *
 * ⚠️ `blur` 를 크게 잡지 않는다. 글자 수만큼 레이어가 생겨 비싸고, 값이 크면
 *    "부드럽다" 가 아니라 "지저분하다" 로 읽힌다.
 */
const glyph = {
  /** 들어오기 전 — 아래에서 초점이 안 맞은 채로 대기한다. **보이기는 한다.** */
  hidden: { y: '0.36em', filter: 'blur(6px)' },
  /** 착지. */
  show: { y: '0em', filter: 'blur(0px)' },
}

export function SplitText({
  text,
  className,
  as = 'span',
  animate = true,
  delay = 0,
  /**
   * 글자 **전체**가 움직이는 데 쓰는 총 시간(초). 간격이 아니다.
   *
   * 🔴 간격을 고정하면 **긴 제목이 끝없이 느려진다** — 20자 제목이 1초에 걸쳐
   *    들어왔다(실측 2026-09-16: 549ms 에 0 → 1599ms 에 100).
   *    총 시간을 묶고 글자 수로 나눈다.
   */
  span = 0.3,
  /** 글자가 적을 때의 간격 상한. 이보다 벌리면 띄엄띄엄해 보인다. */
  maxStep = 0.045,
  duration = 0.46,
}: {
  text: string
  /*
   * ⚠️ `| undefined` 를 명시한다. `exactOptionalPropertyTypes` 가 켜져 있어
   *    `className?: string` 에는 `string | undefined` 를 넘길 수 없다
   *    (실측 TS2375 — `Reveal.tsx` 주석이 같은 함정을 적어놨다).
   */
  className?: string | undefined
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p'
  /**
   * 글자를 쪼개 움직일 것인가.
   *
   * 🔴 `false` 면 원문을 그대로 둔다. 라우트 전환으로 들어온 화면에서는
   *    View Transitions 가 이미 화면을 겹쳐 넘기므로, 여기서 또 `opacity: 0`
   *    으로 시작하면 **VT 가 찍을 그림이 비어 버린다**(`TransitionTitle` 주석).
   */
  animate?: boolean
  delay?: number
  span?: number
  maxStep?: number
  duration?: number
}) {
  /*
   * 폰트가 준비되기 전까지는 원문 그대로 둔다.
   * 서버 렌더 결과와 첫 클라이언트 렌더가 같아야 하이드레이션이 깨지지 않는다.
   */
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

  /** 공백을 유지한 채 단어로 나눈다. 공백 자체도 한 조각으로 남긴다. */
  const words = text.split(/(\s+)/)
  /** 글자에 전역 순번을 매긴다 — 지연을 직접 계산하려면 단어 경계를 넘는 번호가 필요하다. */
  const total = Array.from(text.replace(/\s+/g, '')).length
  /**
   * 글자 사이 간격. **총 시간을 글자 수로 나눈다.**
   * 글자가 적으면 `maxStep` 에 걸려 띄엄띄엄해지지 않는다.
   */
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
              /*
               * 🔴 **`staggerChildren` 을 쓰지 않고 지연을 직접 계산한다.**
               *
               *    처음엔 부모에 `staggerChildren` 을 걸었는데 **글자들이 전부
               *    동시에 움직였다**(실측: 같은 프레임에서 글자 높이 차이 0px).
               *    stagger 는 **직계 motion 자식**만 세는데, 줄바꿈을 막으려고
               *    끼운 단어 래퍼가 일반 `<span>` 이라 그 순서가 글자까지
               *    내려오지 않는다. variants 자체는 전파되므로 **움직이기는 하는데
               *    순서만 사라진다** — 눈으로는 판때기 슬라이드와 구별이 안 된다.
               *
               *    지연을 값으로 주면 중첩 구조와 무관해진다.
               *
               * ⚠️ 나갈 때는 **뒤에서부터** 흩어진다. 들어올 때와 같은 방향이면
               *    두 연출이 한 방향으로 흐르는 띠처럼 보여 "되돌아간다" 가 안 읽힌다.
               */
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
