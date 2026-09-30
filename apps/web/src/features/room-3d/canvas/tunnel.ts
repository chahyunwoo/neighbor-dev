import tunnel from 'tunnel-rat'

// tunnel() 은 이 파일에서 한 번만 부른다 — 두 번 부르면 In/Out 이 다른 store 를 봐 아무것도 안 그려지는데 빌드는 통과한다.
// 'use client' 를 붙이지 않는다 — 서버 컴포넌트가 이 그래프를 스칠 때 경계가 어긋난다.
export const r3f = tunnel()
