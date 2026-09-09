import type { Metadata } from 'next'
import { PageShell } from '../../components/PageShell'
import styles from '../contact/page.module.css'

export const metadata: Metadata = {
  title: '미리 진단해보기',
  description:
    '요구사항을 적으면 기술 스택·대략 기간·리스크를 정리해드립니다. 금액은 말하지 않습니다.',
}

/**
 * 노트북 — 상담 전 자가진단 (기획서 5절).
 *
 * ⚠️ 아직 붙이지 않았다. API 키 보호 때문에 서버가 필요하고, 그 서버(apps/api)가
 *    아직 비어 있다. **"곧 됩니다" 대신 무엇을 할 것인지와 무엇을 하지 않을
 *    것인지를 지금 적는다** — 하지 않을 것을 미리 밝히는 것이 이 기능의 요지다.
 */
export default function DiagnosePage() {
  return (
    <PageShell
      fig="[ fig. 5 · 노트북 · 준비 중 ]"
      crumb="노트북"
      title="내 프로젝트 미리 진단해보기"
      lede="만들고 싶은 것을 적으면 어떤 기술이 필요한지, 대략 얼마나 걸릴지, 어디가 위험한지를 정리해드립니다."
    >
      <div className={styles.wrap}>
        <ul className={styles.points}>
          <li className={styles.point}>
            <span className={styles.pointNo}>합니다</span>
            <span className={styles.pointText}>
              필요한 기술 스택 정리 · 범위를 쪼개는 방법 · 어디가 오래 걸릴지
            </span>
          </li>
          <li className={styles.point}>
            <span className={styles.pointNo}>안 합니다</span>
            <span className={styles.pointText}>
              <strong>금액은 말하지 않습니다.</strong> 요구사항 몇 줄로 나온 숫자가 협상의 기준선이
              되면 서로 손해입니다 — 견적은 사람이 직접 봅니다.
            </span>
          </li>
          <li className={styles.point}>
            <span className={styles.pointNo}>안 합니다</span>
            <span className={styles.pointText}>
              입력하신 내용을 저장하지 않습니다. 결과는 화면에만 표시됩니다.
            </span>
          </li>
        </ul>
        <div className={styles.pending}>
          아직 열지 않았습니다.
          <br />
          입력을 받는 서버부터 만들고 있습니다.
        </div>
      </div>
    </PageShell>
  )
}
