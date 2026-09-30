import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type Fetcher = (url: string, init: RequestInit) => Promise<{ json(): Promise<unknown> }>

// 검증 호출이 실패하면 막는다 — 봇 차단이 목적이라 열어 두면 Cloudflare 장애가 곧 우회로가 된다
export async function turnstileAllows(
  secret: string | undefined,
  token: string | undefined,
  ip: string,
  fetcher: Fetcher = fetch,
): Promise<{ ok: boolean; reason?: string }> {
  if (!secret) return { ok: true }
  if (!token) return { ok: false, reason: 'missing-token' }
  try {
    const res = await fetcher(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    return data.success === true
      ? { ok: true }
      : { ok: false, reason: data['error-codes']?.join(',') || 'rejected' }
  } catch {
    return { ok: false, reason: 'verify-unreachable' }
  }
}

@Injectable()
export class TurnstileService {
  private readonly log = new Logger(TurnstileService.name)
  private readonly secret: string | undefined

  constructor(config: ConfigService) {
    this.secret = config.get<string>('TURNSTILE_SECRET')?.trim() || undefined
    if (!this.secret) {
      this.log.warn('TURNSTILE_SECRET 가 없다. 사람 확인 없이 받는다(로컬 전용).')
    }
  }

  async verify(token: string | undefined, ip: string): Promise<boolean> {
    const { ok, reason } = await turnstileAllows(this.secret, token, ip)
    if (!ok) this.log.warn(`사람 확인 실패: ${reason}`)
    return ok
  }
}
