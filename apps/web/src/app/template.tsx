'use client'

import * as motion from 'motion/react-client'
import { pageIn } from '@/features/reveal'

/**
 * 화면 전환 — Next 의 `template.tsx` 는 경로가 바뀔 때마다 **다시 마운트**된다.
 * `layout.tsx` 는 유지되므로 전환 애니메이션을 걸 수 없다.
 *
 * 🔴 이전에는 전환이 **아예 없었다.** 링크를 누르면 화면이 그냥 바뀌었다
 *    (실측 2026-09-09: 페이지 전환 처리 0건). 3D 로 공간을 만들어 놓고
 *    화면 사이는 뚝 끊기면, 방을 나온 순간 그 공간감이 사라진다.
 *
 * ⚠️ 여기서 `exit` 는 쓰지 않는다 — App Router 의 template 은 나가는 쪽을
 *    붙잡아 두지 않으므로 `AnimatePresence` 를 걸어도 동작하지 않는다.
 *    들어오는 쪽만 처리하고, 나가는 느낌은 짧은 지속시간으로 대신한다.
 *
 * ⚠️ **레이아웃을 흔들지 않는다.** y 이동을 10px 로 작게 잡았다 — 크게 잡으면
 *    스크롤 위치가 튀고, 특히 3D 가 있는 화면에서 캔버스가 같이 흔들린다.
 *
 * 🔴 **그 10px 이 `100dvh` 화면에서는 스크롤바를 만든다** (이슈 #24).
 *    홈은 `.page` 가 `height:100dvh` 라, 아래에서 10px 올라오는 동안 문서가
 *    뷰포트보다 커져 **스크롤바가 나타났다 사라진다** — 실측 2026-09-10:
 *    220~680ms 구간 28프레임, 3회 재현.
 *
 *    이동 자체를 없애지는 않는다(전환이 뚝 끊기면 공간감이 사라진다).
 *    막는 것은 **`<body>` 쪽**이다 — `styles/tokens.css` 의 `overscroll` 규칙
 *    참고. 여기(`motion.div`)에 `overflow:clip` 을 걸면 **자기 자신이 밀리는
 *    것은 못 막는다**(자식만 잘린다). 실측으로 확인했다.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial="hidden" animate="show" variants={pageIn}>
      {children}
    </motion.div>
  )
}
