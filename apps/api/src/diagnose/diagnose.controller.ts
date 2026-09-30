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

  @Get('status')
  status() {
    const q = this.quota.snapshot()
    return {
      available: this.service.available,
      dailyRemaining: Math.max(0, q.dailyCap - q.dailyUsed),
      dailyCap: q.dailyCap,
    }
  }

  // 게이트 판정이 스트림 끝에 온다 — done 이벤트로 통과 여부를 알리고, 걸리면 화면이 지운다
  @Post('stream')
  async stream(@Body() dto: DiagnoseDto, @Ip() ip: string, @Res() res: Response) {
    if (!this.service.available) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ message: '자가진단은 아직 준비 중입니다.' })
      return
    }
    // 모델을 부르기 전에 한 칸을 잡는다. 게이트에 걸려도 비용은 썼으므로 되돌리지 않는다
    const decision = this.quota.reserve(ip)
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
      // 프록시가 버퍼링하면 스트림이 한꺼번에 뭉쳐 온다
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
        send('done', { ok: true })
      } else {
        // 무엇에 걸렸는지는 알리지 않는다
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
    if (!this.service.available) {
      throw new HttpException('자가진단은 아직 준비 중입니다.', HttpStatus.SERVICE_UNAVAILABLE)
    }
    // 모델을 부르기 전에 한 칸을 잡는다. 호출 뒤 실패는 비용을 썼을 수 있어 되돌리지 않는다
    const decision = this.quota.reserve(ip)
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
    return { result }
  }
}
