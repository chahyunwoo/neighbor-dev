import { NextResponse } from 'next/server'

/**
 * 자가진단 프록시.
 *
 * 🔴 브라우저가 api 를 **직접 부르지 않게** 한다. 직접 부르면 api 주소가
 *    페이지 HTML 에 박혀 나가고, 배포하면 그게 곧 자체 호스팅 구성 노출이다
 *    (기획서 8절: 호스트명·포트·터널 구성은 산출물에 일절 쓰지 않는다).
 *    실측 2026-09-09: 렌더 검사가 `http://localhost:3100` 을 화면에서 잡았다.
 *
 * 부수 효과로 CORS 도 필요 없어진다 — 같은 출처가 된다.
 */

/** 서버에서만 읽는다. NEXT_PUBLIC_ 접두사를 쓰지 않는 것이 요점이다. */
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3100'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: '요청을 읽지 못했습니다.' }, { status: 400 })
  }

  try {
    const res = await fetch(`${API_BASE}/diagnose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 방문자 IP 를 넘겨야 api 의 IP 별 제한이 실제로 작동한다.
        'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    // api 주소나 원인을 방문자에게 알리지 않는다.
    return NextResponse.json(
      { message: '지금은 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 503 },
    )
  }
}
