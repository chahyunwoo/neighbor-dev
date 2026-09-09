import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Ip, Post } from '@nestjs/common'
import { DiagnoseDto } from './diagnose.dto'
import { DiagnoseService } from './diagnose.service'
import { QuotaService } from './quota.service'

@Controller('diagnose')
export class DiagnoseController {
  constructor(
    private readonly service: DiagnoseService,
    private readonly quota: QuotaService,
  ) {}

  /** 화면이 "지금 쓸 수 있는가" 를 먼저 묻는다. 남은 횟수도 같이 준다. */
  @Get('status')
  status() {
    const q = this.quota.snapshot()
    return {
      available: this.service.available,
      dailyRemaining: Math.max(0, q.dailyCap - q.dailyUsed),
      dailyCap: q.dailyCap,
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async diagnose(@Body() dto: DiagnoseDto, @Ip() ip: string) {
    // 🔴 캡 검사가 먼저다. 모델을 부르기 전에 막아야 비용 방어가 된다.
    const decision = this.quota.check(ip)
    if (!decision.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            decision.reason === 'daily-cap'
              ? '오늘 준비한 진단 횟수를 다 썼습니다. 내일 다시 열립니다 — 급하시면 문의로 직접 말씀해 주세요.'
              : '잠시 뒤에 다시 시도해 주세요.',
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const result = await this.service.diagnose(dto.requirement)
    // 실제로 부른 뒤에 소비한다 — 실패한 호출로 캡이 깎이지 않게.
    this.quota.consume(ip)
    return { result }
  }
}
