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
  /**
   * 패널 한 줄 설명 — 마커를 눌렀을 때 방을 떠나지 않고 먼저 보이는 것.
   * 시안(HOT[].sub)에서 왔다.
   */
  sub: string
  /** 패널 안 요약 행. `[왼쪽, 오른쪽]`. 시안(HOT[].rows). */
  rows: readonly (readonly [string, string])[]
  /**
   * 한 줄 소신. 시안(HOT[].note).
   * 🔴 여기서 "말" 이 따뜻해진다 — 화면은 차갑게 두고 이 문장이 온기를 진다(기획서 4-A).
   */
  note: string
}

export const ROOM_OBJECTS: readonly RoomObject[] = [
  {
    no: 1,
    id: 'monitor',
    name: '모니터',
    opens: '프로젝트 진행 과정',
    href: '/work',
    accent: 'amber',
    sub: '프로젝트마다 어떤 설계 판단을 했고 어떤 결과가 나왔는지 정리했습니다.',
    rows: [
      ['설계 판단', '선택안 · 대안 · 근거 · 비용'],
      ['결과 지표', '재현 가능한 수치만'],
      ['보기 전환', '판단 / 지표'],
    ],
    note: '발주 담당자는 설계 판단을, 개발자는 결과 지표를 확인할 수 있습니다.',
  },
  {
    no: 2,
    id: 'whiteboard',
    name: '화이트보드',
    opens: '수행 사례',
    href: '/work',
    accent: 'blue',
    sub: '2025년 4월 이후 수행한 프로젝트입니다. 고객사명은 모두 익명으로 표기합니다.',
    rows: [
      ['상세 사례', '10건'],
      ['요약 사례', '6건'],
      ['표기 항목', '업종 · 기간 · 기술'],
    ],
    note: '계약이 끝난 뒤에도 고객사명은 공개하지 않습니다.',
  },
  {
    no: 3,
    id: 'bookshelf',
    name: '책장',
    opens: '기술 스택',
    href: '/stack',
    accent: 'blue',
    sub: '수행 프로젝트에서 사용한 기술을 분야별로 정리했습니다.',
    rows: [
      ['백엔드', 'NestJS · Spring Boot · FastAPI'],
      ['프론트엔드', 'Next.js · React · TanStack'],
      ['인프라', 'Docker · GitHub Actions · PostgreSQL'],
    ],
    note: '실무에서 사용하지 않은 기술은 표기하지 않습니다.',
  },
  {
    no: 4,
    id: 'drawer',
    name: '서랍',
    opens: '비공개 프로젝트',
    href: '/career',
    accent: 'blue',
    sub: '고객사 자산이 포함되어 상세 내용을 공개할 수 없는 프로젝트입니다. 업종, 기간, 기술만 표기합니다.',
    rows: [
      ['대기업 백오피스 디자인 시스템', '2025.08—12'],
      ['커머스 플랫폼 주문 검증', '2026.05'],
      ['데스크톱 수집 앱', '2026.07'],
    ],
    note: '심사 기준이나 수수료 산식 같은 업무 규칙은 고객사 자산이므로 공개하지 않습니다.',
  },
  {
    no: 5,
    id: 'laptop',
    name: '노트북',
    opens: '프로젝트 사전 진단',
    href: '/diagnose',
    accent: 'blue',
    sub: '요구사항을 입력하면 권장 기술 스택, 예상 기간, 주요 리스크를 정리해 드립니다.',
    rows: [
      ['범위', '1차 개발에서 뺄 항목 선택'],
      ['예상 기간', '최소~최대 범위로 제시'],
      ['리스크', '등급별 정리'],
    ],
    note: '진단 결과에는 견적 금액을 포함하지 않습니다.',
  },
  {
    no: 6,
    id: 'team',
    name: '테이블',
    opens: '팀 소개',
    href: '/team',
    accent: 'blue',
    sub: '2026년 1월 설립. PM, 프론트엔드, 백엔드, 디자인 4인이 직접 개발합니다.',
    rows: [
      ['PM · 풀스택', '기획 · 설계 · 프론트엔드 · 백엔드'],
      ['프론트엔드', '1명'],
      ['백엔드', '1명'],
      ['디자인', '1명'],
    ],
    note: 'PM이 요구사항 정의부터 납품까지 직접 관리합니다.',
  },
  {
    no: 7,
    id: 'door',
    name: '현관문',
    opens: '프로젝트 문의',
    href: '/contact',
    accent: 'amber',
    sub: '요구사항이 정리되지 않았어도 문의하실 수 있습니다. 범위 정의부터 함께 진행합니다.',
    rows: [
      ['입력 항목', '이름 · 이메일 · 문의 내용'],
      ['보관', '저장하지 않고 메일로만 전달'],
      ['답변', '영업일 기준 1일 이내'],
    ],
    note: '문의 내용은 서버에 저장하지 않습니다.',
  },
] as const

/**
 * 물건 → 그 화면 배경에 세울 3D 모델.
 *
 * 🔴 방에서 물건을 누르면 그 물건이 **화면으로 이어진다**(기획서 4절).
 *    이전에는 페이지로 오는 순간 3D 가 사라져 평범한 문서가 됐다.
 *
 * ⚠️ 모니터·화이트보드는 Kenney 팩에 없어 직접 만든 것이라(`Fixtures.tsx`)
 *    배경으로 세울 glb 가 없다. 대신 **책상**을 세운다 — 그 둘이 놓인 자리다.
 *    억지로 비슷한 모델을 끌어오지 않는다.
 *
 * `rotationY`·`scale` 은 배경에서 잘 보이는 각도·크기다. 방의 배치값과
 * 다른 것이 맞다 — 방에서는 벽에 붙어 있고 여기서는 혼자 서 있다.
 */
export const OBJECT_MODEL: Record<string, { model: string; rotationY: number; scale: number }> = {
  monitor: { model: 'desk', rotationY: -28, scale: 1.15 },
  whiteboard: { model: 'desk', rotationY: -28, scale: 1.15 },
  bookshelf: { model: 'bookcaseOpen', rotationY: -24, scale: 1.5 },
  drawer: { model: 'sideTableDrawers', rotationY: -30, scale: 1.7 },
  laptop: { model: 'laptop', rotationY: -35, scale: 4.2 },
  team: { model: 'table', rotationY: -22, scale: 1.3 },
  door: { model: 'doorway', rotationY: -20, scale: 1.25 },
}
