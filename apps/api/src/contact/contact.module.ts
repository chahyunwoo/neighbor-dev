import { Module } from '@nestjs/common'
import { DiagnoseModule } from '../diagnose/diagnose.module'
import { ContactController } from './contact.controller'
import { ContactService } from './contact.service'

/**
 * 🔴 QuotaService 를 여기서 provider 로 선언하지 않는다. 선언하면 **인스턴스가
 *    둘이 되어 각자 카운터를 갖고, 캡이 사실상 두 배가 된다** — 비용 방어가
 *    조용히 무너지는 형태다. DiagnoseModule 이 내보내는 하나를 가져다 쓴다.
 */
@Module({
  imports: [DiagnoseModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
