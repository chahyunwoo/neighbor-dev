const API_BASE = process.env.API_BASE_URL || 'http://localhost:21201'

/** api 호출. 운영에서는 내부 토큰을 붙인다 — api 가 토큰 없는 요청(터널 주소 직접 호출)을 막는다. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = process.env.INTERNAL_TOKEN
  if (token) headers.set('x-internal-token', token)
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}
