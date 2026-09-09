import { NextResponse } from 'next/server'

/**
 * 문의 프록시.
 *
 * 🔴 브라우저가 api 를 직접 부르지 않게 한다 — 직접 부르면 api 주소가 페이지에
 *    박히고, 배포하면 그게 곧 자체 호스팅 구성 노출이다(기획서 8절).
 *    자가진단 프록시와 같은 이유·같은 구조다.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3100'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: '요청을 읽지 못했습니다.' }, { status: 400 })
  }

  try {
    const res = await fetch(`${API_BASE}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 방문자 IP 를 넘겨야 api 의 IP 별 제한이 실제로 작동한다.
        'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json(
      { message: '지금은 접수가 되지 않습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 503 },
    )
  }
}
