import { timingSafeEqual } from 'node:crypto'
import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

// web 서버 프록시만 붙이는 헤더. 브라우저는 이 값을 모른다
export const INTERNAL_TOKEN_HEADER = 'x-internal-token'

// 터널 주소로 직접 들어오면 X-Forwarded-For 위조로 IP 제한을 우회할 수 있어 막는다. 토큰 미설정(로컬)은 통과
export function internalTokenAllows(
  expected: string | undefined,
  got: unknown,
  path: string,
): boolean {
  if (!expected) return true
  if (path === '/health') return true
  if (typeof got !== 'string') return false
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

@Injectable()
export class InternalTokenGuard implements CanActivate {
  private readonly token: string | undefined

  constructor(config: ConfigService) {
    this.token = config.get<string>('INTERNAL_TOKEN') || undefined
    if (!this.token) {
      new Logger(InternalTokenGuard.name).warn(
        'INTERNAL_TOKEN 이 없다. 공개 주소로 직접 들어온 요청도 받는다(로컬 개발 전용).',
      )
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      path: string
      headers: Record<string, unknown>
    }>()
    return internalTokenAllows(this.token, req.headers[INTERNAL_TOKEN_HEADER], req.path)
  }
}
