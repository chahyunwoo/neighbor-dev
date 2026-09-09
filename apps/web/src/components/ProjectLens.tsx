'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import styles from './ProjectLens.module.css'

export type LensKey = 'decisions' | 'metrics'

interface Props {
  decisionCount: number
  metricCount: number
  decisions: ReactNode
  metrics: ReactNode
}

/**
 * 사례를 보는 두 방식 — 기획서 4절의 토글.
 *
 * | 축 | 보여주는 것 | 주 독자 |
 * |---|---|---|
 * | 어떻게 판단했나 | 선택·대안·이유·대가 | 발주자 |
 * | 무엇이 나왔나 | 수치와 그 재현 명령 | 개발자·CTO |
 *
 * ⚠️ 기획서 원안은 "진행 흐름 ↔ 구조 흐름" 이었다. 그 데이터가 정본에 없어
 *    (사례 10건 전부 단계 구분도 노드 연결도 없다 — 2026-09-09 실측)
 *    **지어내는 대신 축을 바꿨다.** 한쪽만 두면 다른 쪽 방문자가 읽을 게
 *    없다는 기획 의도는 그대로다.
 *
 * 🔴 **두 내용을 모두 DOM 에 둔다.** 안 보이는 쪽은 `hidden` 으로 감출 뿐
 *    렌더는 한다 — 클라이언트 컴포넌트가 한쪽만 렌더하면 서버가 내보내는
 *    HTML 에도 한쪽만 들어가고, 크롤러가 수치를 통째로 놓친다.
 *    (확인: `curl / | grep 재현` 으로 두 축이 다 나오는지 센다.)
 */
export function ProjectLens({ decisionCount, metricCount, decisions, metrics }: Props) {
  const [lens, setLens] = useState<LensKey>('decisions')

  return (
    <div>
      <div className={styles.head}>
        <span className={styles.headLabel}>보는 방식</span>
        <div className={styles.toggle} role="tablist" aria-label="사례를 보는 방식">
          <button
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={lens === 'decisions'}
            aria-controls="lens-decisions"
            onClick={() => setLens('decisions')}
          >
            어떻게 판단했나
            <span className={styles.count}>{decisionCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={lens === 'metrics'}
            aria-controls="lens-metrics"
            onClick={() => setLens('metrics')}
          >
            무엇이 나왔나
            <span className={styles.count}>{metricCount}</span>
          </button>
        </div>
      </div>

      {/* 둘 다 렌더하고 안 보이는 쪽만 감춘다 — 위 주석의 이유. */}
      <div
        className={styles.panel}
        id="lens-decisions"
        role="tabpanel"
        hidden={lens !== 'decisions'}
      >
        {decisionCount > 0 ? (
          decisions
        ) : (
          <p className={styles.empty}>이 건은 판단 기록을 공개하지 않습니다.</p>
        )}
      </div>
      <div className={styles.panel} id="lens-metrics" role="tabpanel" hidden={lens !== 'metrics'}>
        {metricCount > 0 ? (
          metrics
        ) : (
          <p className={styles.empty}>
            재현 명령이 있는 수치만 싣습니다. 이 건은 그 조건을 만족하는 수치가 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}
