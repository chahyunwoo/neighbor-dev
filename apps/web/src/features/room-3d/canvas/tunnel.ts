import tunnel from 'tunnel-rat'

/**
 * 3D 내용을 지속 캔버스로 실어 나르는 통로.
 *
 * 🔴 **`tunnel()` 은 이 파일에서 한 번만 부른다.** 두 번 부르면 `In` 과
 *    `Out` 이 서로 다른 store 를 보게 되어 **아무것도 안 그려지는데
 *    타입도 빌드도 통과한다** — 이 프로젝트가 가장 경계하는 실패 형태다.
 *    그래서 파일을 따로 뺐다. 여기서 export 한 `r3f` 만 쓴다.
 *
 * ⚠️ `'use client'` 를 붙이지 않는다. 이 모듈을 import 하는 쪽
 *    (`CanvasRoot` · `RoomScene` · `ObjectScene`)이 전부 클라이언트라
 *    필요 없고, 붙이면 서버 컴포넌트가 이 그래프를 스칠 때 경계가 어긋난다.
 */
export const r3f = tunnel()
