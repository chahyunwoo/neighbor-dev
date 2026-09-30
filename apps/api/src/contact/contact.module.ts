import { Module } from '@nestjs/common'
import { DiagnoseModule } from '../diagnose/diagnose.module'
import { ContactController } from './contact.controller'
import { ContactService } from './contact.service'

// QuotaService 를 provider 로 재선언하지 않는다 — 인스턴스가 둘이 되어 캡이 두 배가 된다
@Module({
  imports: [DiagnoseModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
