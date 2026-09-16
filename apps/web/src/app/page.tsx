import { getCounts } from '@/entities/project'
import { ROOM_OBJECTS } from '@/entities/room'
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
  const counts = getCounts()

  return (
    <div className={styles.page}>
      <div className={styles.lamp} aria-hidden="true" />
      <Nav />

      <main className={styles.main}>
        <Hero>
          <p className={styles.caption}>
            [ fig. 1 · 작업실 · 클릭할 수 있는 것 {ROOM_OBJECTS.length} ]
          </p>
          <div className={styles.copy}>
            <h1 className={styles.title}>
              들어와서
              <br />
              <strong>둘러보세요.</strong>
            </h1>
            <p className={styles.lede}>
              이 방의 물건은 전부 열립니다. 모니터를 켜면 프로젝트가 어떻게 굴러갔는지 보이고,
              화이트보드엔 그동안 만든 것들이 붙어 있어요.
            </p>
          </div>
        </Hero>
      </main>

      <footer className={styles.foot}>
        <p className={styles.footCopy}>
          웹·앱을 기획부터 배포까지 만듭니다. 화면도 서버도 직접 합니다.
        </p>
        <div className={styles.footStats}>
          <span>9년</span>
          <span>{counts.detail + counts.summary}건</span>
          <span>NestJS · Next.js · Spring Boot</span>
        </div>
      </footer>
    </div>
  )
}
