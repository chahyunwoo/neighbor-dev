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

// 두 축을 모두 DOM 에 둔다 — 한쪽만 렌더하면 크롤러가 수치를 놓친다.
export function ProjectLens({ decisionCount, metricCount, decisions, metrics }: Props) {
  const [lens, setLens] = useState<LensKey>('decisions')

  return (
    <div>
      <div className={styles.head}>
        <span className={styles.headLabel}>보기</span>
        <div className={styles.toggle} role="tablist" aria-label="사례를 보는 방식">
          <button
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={lens === 'decisions'}
            aria-controls="lens-decisions"
            onClick={() => setLens('decisions')}
          >
            설계 판단
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
            결과 지표
            <span className={styles.count}>{metricCount}</span>
          </button>
        </div>
      </div>

      {/* 둘 다 렌더하고 안 보이는 쪽만 hidden 으로 감춘다. */}
      <div
        className={styles.panel}
        id="lens-decisions"
        role="tabpanel"
        hidden={lens !== 'decisions'}
      >
        {decisionCount > 0 ? (
          decisions
        ) : (
          <p className={styles.empty}>이 프로젝트는 설계 판단을 공개하지 않습니다.</p>
        )}
      </div>
      <div className={styles.panel} id="lens-metrics" role="tabpanel" hidden={lens !== 'metrics'}>
        {metricCount > 0 ? (
          metrics
        ) : (
          <p className={styles.empty}>
            재현 명령이 있는 수치만 싣습니다. 이 프로젝트에는 해당 수치가 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}
