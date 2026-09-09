/**
 * 방의 물건 6개 — 시안(Main.dc.html)의 배지 1~6 과 같은 순서·같은 뜻이다.
 *
 * 🔴 물건을 열면 반드시 **일**이 나와야 한다 (기획서 4절).
 *    서재 감상으로 끝나는 오브젝트는 넣지 않는다 — 주어가 "나"에 머물면
 *    개발자 방 구경이 되고, 발주자가 볼 것이 없어진다.
 *
 * 이 목록이 3D(데스크톱)·목록(모바일)·서버 렌더 HTML(크롤러) **세 경로의
 * 같은 데이터 소스**다. 3D 는 표현 계층일 뿐이다.
 */

export type Accent = 'amber' | 'blue'

export interface RoomObject {
  /** 시안의 배지 번호. */
  no: number
  id: string
  /** 물건 이름 — 공간의 말. */
  name: string
  /** 그 물건이 여는 것 — 일의 말. */
  opens: string
  href: string
  /** 앰버는 주 동선(모니터·현관문), 블루는 나머지. */
  accent: Accent
}

export const ROOM_OBJECTS: readonly RoomObject[] = [
  {
    no: 1,
    id: 'monitor',
    name: '모니터',
    opens: '프로젝트가 어떻게 굴러갔나',
    href: '/work',
    accent: 'amber',
  },
  {
    no: 2,
    id: 'whiteboard',
    name: '화이트보드',
    opens: '그동안 만든 것',
    href: '/work',
    accent: 'blue',
  },
  {
    no: 3,
    id: 'bookshelf',
    name: '책장',
    opens: '쓰는 기술',
    href: '/stack',
    accent: 'blue',
  },
  {
    no: 4,
    id: 'drawer',
    name: '서랍',
    opens: '이름 못 밝히는 일들',
    href: '/career',
    accent: 'blue',
  },
  {
    no: 5,
    id: 'laptop',
    name: '노트북',
    opens: '내 프로젝트 미리 진단해보기',
    href: '/diagnose',
    accent: 'blue',
  },
  {
    no: 6,
    id: 'door',
    name: '현관문',
    opens: '일 맡기기',
    href: '/contact',
    accent: 'amber',
  },
] as const
