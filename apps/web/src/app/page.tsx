import { TransitionTitle } from '@/features/page-transition'
import { COMPANY } from '@/shared/lib'
import { Hero } from '@/widgets/hero'
import { Nav } from '@/widgets/nav'
import styles from './page.module.css'

/**
 * 히어로 — 작업실.
 *
 * 지금은 폴백 3단 중 **3단(서버 렌더 HTML)** 만 있다. 3D 는 다음 단계에서
 * 이 위에 얹는다. 순서가 이런 이유는 기획서 4절이 세 경로를 **같은 데이터
 * 소스**로 못박았기 때문이다 — 바닥을 먼저 세워야 3D 가 표현 계층에 머문다.
 */
export default function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.lamp} aria-hidden="true" />
      <Nav />

      <main className={styles.main}>
        <Hero>
          <div className={styles.copy}>
            {/*
             * 🔴 두 줄을 각각 쪼갠다. `<br>` 과 `<strong>` 때문에 한 문자열로는
             *    못 넘긴다 — 대신 `aria-label` 을 h1 에 직접 줘서 스크린리더가
             *    한 문장으로 읽게 한다.
             * ⚠️ 둘째 줄에 지연을 더한다. 안 주면 두 줄이 동시에 움직여
             *    한 덩어리로 보인다.
             */}
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
        <div className={styles.footLegal}>
          <p>
            {COMPANY.name} · 대표 {COMPANY.owner} · 사업자등록번호 {COMPANY.bizNo}
          </p>
          <p>
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> · © {new Date().getFullYear()}{' '}
            이웃집 개발자
          </p>
        </div>
      </footer>
    </div>
  )
}
