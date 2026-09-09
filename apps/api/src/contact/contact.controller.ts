import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Ip, Post } from '@nestjs/common'
import { QuotaService } from '../diagnose/quota.service'
import { ContactDto } from './contact.dto'
import { ContactService } from './contact.service'

@Controller('contact')
export class ContactController {
  constructor(
    private readonly service: ContactService,
    private readonly quota: QuotaService,
  ) {}

  /** 화면이 "지금 받을 수 있는가" 를 먼저 묻는다. */
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
    const decision = this.quota.check(ip, 'contact')
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

    await this.service.send(dto)
    // 실제로 보낸 뒤에 소비한다 — 실패한 발송으로 캡이 깎이지 않게.
    this.quota.consume(ip, 'contact')
    return { ok: true }
  }
}
