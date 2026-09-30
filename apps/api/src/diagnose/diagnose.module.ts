import { Module } from '@nestjs/common'
import { DiagnoseController } from './diagnose.controller'
import { DiagnoseService } from './diagnose.service'
import { TurnstileService } from '../turnstile.service'
import { QuotaService } from './quota.service'

@Module({
  controllers: [DiagnoseController],
  providers: [DiagnoseService, QuotaService, TurnstileService],
  // QuotaService 는 여기서만 만든다 — 모듈마다 선언하면 카운터가 갈라져 캡이 배로 는다
  exports: [QuotaService, TurnstileService],
})
export class DiagnoseModule {}
