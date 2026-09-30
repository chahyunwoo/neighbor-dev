// 스트리밍 프록시 — 본문을 그대로 흘려보낸다. res.json() 으로 받으면 스트리밍이 뭉친다.

import { apiFetch } from '@/shared/api'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: '요청을 읽지 못했습니다.' }, { status: 400 })
  }

  try {
    const upstream = await apiFetch('/diagnose/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    // 캡에 걸린 경우 등 — api 가 JSON 으로 답한다.
    if (!upstream.ok || !upstream.body) {
      const data = await upstream.json().catch(() => ({
        message: '지금은 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      }))
      return Response.json(data, { status: upstream.status })
    }

    // 여기서 읽어 모으면 스트리밍이 죽는다.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return Response.json(
      { message: '지금은 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 503 },
    )
  }
}
