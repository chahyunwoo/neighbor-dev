'use client'

import * as motion from 'motion/react-client'
import { fade } from '@/features/reveal'

/**
 * 화면 전환의 바닥 — Next 의 `template.tsx` 는 경로가 바뀔 때마다 **다시 마운트**된다.
 * `layout.tsx` 는 유지되므로 들어오는 연출을 걸 수 있는 자리가 여기다.
 *
 * 🔴 **여기서는 위치를 움직이지 않는다. 페이드만 한다.**
 *
 *    전에는 `pageIn`(y 10px + opacity)으로 **화면 전체를 한 덩어리로** 밀어
 *    올렸다. 그게 우리가 피하려던 그 흔한 판때기 슬라이드였고, 글자 단위
 *    연출(`TransitionTitle`)과 겹쳐 같은 것이 두 번 움직였다.
 *
 *    이제 움직이는 것은 **제목의 낱글자와 본문**이고(`features/page-transition`),
 *    이 바닥은 그 둘을 받쳐 주는 페이드만 맡는다. 시차가 있어야 글자가
 *    따로 논다는 것이 읽힌다.
 *
 * 🔴 부수 효과로 **#24(첫 페인트 스크롤바 깜빡임)의 원인이 사라진다.**
 *    100dvh 화면에서 아래 10px 에서 올라오는 동안 문서가 뷰포트보다 커져
 *    스크롤바가 나타났다 사라졌다(실측 2026-09-10: 220~680ms 28프레임, 3회 재현).
 *    이동이 없으면 그 일이 아예 안 생긴다.
 *    ⚠️ 그렇다고 `tokens.css` 의 `overscroll` 방어를 걷어내지 않는다 —
 *       다른 경로(본문 연출 등)로 같은 증상이 날 수 있고, 그 방어는 싸다.
 *
 * ⚠️ 나가는 연출은 여기 없다. App Router 의 template 은 나가는 쪽을 붙잡아
 *    두지 않아 `AnimatePresence` 가 동작하지 않는다 — 대신 `TransitionRoot` 가
 *    **라우트를 바꾸기 전에** 연출을 재생하고 나서 이동한다.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial="hidden" animate="show" variants={fade}>
      {children}
    </motion.div>
  )
}
