import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ContactModule } from './contact/contact.module'
import { DiagnoseModule } from './diagnose/diagnose.module'
import { HealthController } from './health.controller'
import { InternalTokenGuard } from './internal-token'

// env 경로는 __dirname 기준 절대경로 — 상대경로면 작업 디렉터리에 따라 키를 조용히 못 읽는다(에러 없이 available:false)
const API_ROOT = join(__dirname, '..')

@Module({
  imports: [
    // .env 는 커밋하지 않는다. 로컬은 .env.local
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(API_ROOT, '.env.local'), join(API_ROOT, '.env')],
    }),
    DiagnoseModule,
    ContactModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: InternalTokenGuard }],
})
export class AppModule {}
