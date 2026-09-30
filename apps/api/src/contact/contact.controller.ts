import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Ip, Post } from '@nestjs/common'
import { QuotaService } from '../diagnose/quota.service'
import { TurnstileService } from '../turnstile.service'
import { ContactDto } from './contact.dto'
import { ContactService } from './contact.service'

@Controller('contact')
export class ContactController {
  constructor(
    private readonly service: ContactService,
    private readonly quota: QuotaService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Get('status')
  status() {
    const q = this.quota.snapshot('contact')
    return {
      available: this.service.available,
      dailyRemaining: Math.max(0, q.dailyCap - q.dailyUsed),
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async submit(@Body() dto: ContactDto, @Ip() ip: string) {
    if (!this.service.available) {
      throw new HttpException('문의 접수는 아직 준비 중입니다.', HttpStatus.SERVICE_UNAVAILABLE)
    }
    if (!(await this.turnstile.verify(dto.turnstileToken, ip))) {
      throw new HttpException('사람 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.', HttpStatus.FORBIDDEN)
    }
    const decision = this.quota.reserve(ip, 'contact')
    if (!decision.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            decision.reason === 'daily-cap'
              ? '오늘은 더 받지 못합니다. 내일 다시 열립니다.'
              : '방금 보내주셨습니다. 잠시 뒤에 다시 시도해 주세요.',
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    try {
      await this.service.send(dto)
    } catch (err) {
      // 발송 실패는 비용이 없다 — 방문자가 다시 보낼 수 있게 되돌린다
      this.quota.refund(decision.ticket)
      throw err
    }
    return { ok: true }
  }
}
