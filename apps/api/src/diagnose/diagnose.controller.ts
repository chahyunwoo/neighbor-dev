import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Ip,
  Post,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
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

  /**
   * 스트리밍 진단. 조각이 나오는 대로 SSE 로 흘려보낸다.
   *
   * 🔴 게이트가 늦게 온다(서비스 주석 참고). 끝에서 `done` 이벤트로
   *    통과 여부를 알리고, 걸리면 화면이 지운다.
   */
  @Post('stream')
  async stream(@Body() dto: DiagnoseDto, @Ip() ip: string, @Res() res: Response) {
    const decision = this.quota.check(ip)
    if (!decision.allowed) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        message:
          decision.reason === 'daily-cap'
            ? '오늘 준비한 진단 횟수를 다 썼습니다. 내일 다시 열립니다 — 급하시면 문의로 직접 말씀해 주세요.'
            : '잠시 뒤에 다시 시도해 주세요.',
        retryAfterSeconds: decision.retryAfterSeconds,
      })
      return
    }

    res.writeHead(HttpStatus.OK, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // 프록시가 버퍼링하면 스트리밍이 통째로 뭉쳐 온다.
      'X-Accel-Buffering': 'no',
    })

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      const { ok } = await this.service.diagnoseStream(dto.requirement, (delta) => {
        send('delta', { text: delta })
      })
      if (ok) {
        this.quota.consume(ip)
        send('done', { ok: true })
      } else {
        // 게이트에 걸렸다. 무엇이 걸렸는지는 알리지 않는다.
        send('done', {
          ok: false,
          message:
            '결과를 검토하는 과정에서 걸러졌습니다. 문의로 직접 말씀해 주시면 사람이 답변드리겠습니다.',
        })
      }
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? ((err as { response?: { message?: string } }).response?.message ??
            '결과를 만들지 못했습니다.')
          : '결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'
      send('error', { message })
    } finally {
      res.end()
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
