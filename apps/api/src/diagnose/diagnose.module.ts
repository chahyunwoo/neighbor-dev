import { Module } from '@nestjs/common'
import { DiagnoseController } from './diagnose.controller'
import { DiagnoseService } from './diagnose.service'
import { QuotaService } from './quota.service'

@Module({
  controllers: [DiagnoseController],
  providers: [DiagnoseService, QuotaService],
  // 🔴 QuotaService 는 **하나만 있어야 한다.** 다른 모듈이 각자 선언하면
  //    카운터가 갈라져 캡이 배수로 늘어난다. 여기서만 만들고 내보낸다.
  exports: [QuotaService],
})
export class DiagnoseModule {}
