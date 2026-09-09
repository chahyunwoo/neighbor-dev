import { Module } from '@nestjs/common'
import { DiagnoseController } from './diagnose.controller'
import { DiagnoseService } from './diagnose.service'
import { QuotaService } from './quota.service'

@Module({
  controllers: [DiagnoseController],
  providers: [DiagnoseService, QuotaService],
})
export class DiagnoseModule {}
