import type { Metadata } from 'next'
import { PageShell } from '../../components/PageShell'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: '일 맡기기',
  description: '무엇을 만들지 정해지지 않아도 괜찮습니다. 범위를 같이 정리하는 것부터 합니다.',
}

/**
 * 현관문 — 문의.
 *
 * ⚠️ 문의 접수 수단은 아직 정하지 않았다(기획서 8절 재판단 사항).
 *    정해지지 않은 것을 정해진 것처럼 그리지 않는다 — 지금은 그 사실을 적는다.
 */
export default function ContactPage() {
  return (
    <PageShell
      fig="[ fig. 6 · 현관문 ]"
      crumb="현관문"
      title="일 맡기기"
      lede="무엇을 만들지 아직 안 정해졌어도 괜찮습니다. 범위를 같이 정리하는 것부터 합니다."
    >
      <div className={styles.wrap}>
        <p className={styles.prose}>
          기획서가 없어도, 화면 몇 장만 있어도 시작할 수 있습니다. 먼저 무엇을 만들 것인지 같이
          정리하고, 그 다음에 일정과 비용을 이야기합니다.
        </p>
        <ul className={styles.points}>
          <li className={styles.point}>
            <span className={styles.pointNo}>01</span>
            <span className={styles.pointText}>
              화면도 서버도 한 팀에서 합니다. 중간에 넘기는 구간이 없습니다.
            </span>
          </li>
          <li className={styles.point}>
            <span className={styles.pointNo}>02</span>
            <span className={styles.pointText}>
              무엇을 왜 그렇게 만들었는지 남깁니다. 다음 사람이 이어받을 수 있게요.
            </span>
          </li>
          <li className={styles.point}>
            <span className={styles.pointNo}>03</span>
            <span className={styles.pointText}>못 하는 것은 못 한다고 먼저 말씀드립니다.</span>
          </li>
        </ul>
        <div className={styles.pending}>
          문의 접수 수단은 준비 중입니다.
          <br />
          정해지면 이 자리에 붙습니다.
        </div>
      </div>
    </PageShell>
  )
}
