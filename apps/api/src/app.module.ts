import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ContactModule } from './contact/contact.module'
import { DiagnoseModule } from './diagnose/diagnose.module'

@Module({
  imports: [
    // 🔴 .env 는 커밋되지 않는다. 로컬은 .env.local 을 쓴다.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    DiagnoseModule,
    ContactModule,
  ],
})
export class AppModule {}
