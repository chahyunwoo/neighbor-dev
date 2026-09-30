import { TransitionTitle } from '@/features/page-transition'
import { LegalLine } from '@/shared/ui'
import { Hero } from '@/widgets/hero'
import { Nav } from '@/widgets/nav'
import styles from './page.module.css'

export default function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.lamp} aria-hidden="true" />
      <Nav />

      <main className={styles.main}>
        <Hero>
          <div className={styles.copy}>
            {/* 두 줄을 각각 쪼개고 h1 aria-label 로 한 문장으로 읽힌다. 둘째 줄은 늦춰야 한 덩어리로 안 보인다. */}
            <h1 className={styles.title} aria-label="기획부터 배포까지, 한 팀이 만듭니다.">
              <TransitionTitle as="span" text="기획부터 배포까지," />
              <br />
              <strong>
                <TransitionTitle as="span" text="한 팀이 만듭니다." delayMs={90} />
              </strong>
            </h1>
            <p className={styles.lede}>
              웹 서비스와 관리자 시스템, 앱을 기획 단계부터 설계·개발·배포까지 맡는 4인
              개발팀입니다. 방 안의 물건을 누르면 수행 사례와 기술 스택을 볼 수 있습니다.
            </p>
          </div>
        </Hero>
      </main>

      <footer className={styles.foot}>
        <p className={styles.footCopy}>웹·앱 기획, 설계, 개발, 배포</p>
        <LegalLine className={styles.footLegal} />
      </footer>
    </div>
  )
}
