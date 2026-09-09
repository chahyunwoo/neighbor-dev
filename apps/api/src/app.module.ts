import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ContactModule } from './contact/contact.module'
import { DiagnoseModule } from './diagnose/diagnose.module'
import { HealthController } from './health.controller'

/**
 * 🔴 env 경로를 **`__dirname` 기준 절대경로**로 잡는다.
 *
 * 상대경로(`.env.local`)는 프로세스의 작업 디렉터리를 따르므로, 저장소
 * 루트에서 `node apps/api/dist/main.js` 로 띄우면 파일을 못 찾는다.
 * 그런데 **에러가 나지 않는다** — 키가 없는 것으로 읽혀 `/diagnose/status`
 * 가 `available:false` 로 정상 응답하고, 화면은 "준비 중" 을 띄운다.
 * 실측 2026-09-09: 루트에서 띄워 `available:false`, `apps/api` 에서 띄워
 * `available:true` 가 나왔다 — 같은 빌드, 같은 키인데 갈렸다.
 *
 * 배포에서도 같은 형태로 밟는다(작업 디렉터리는 실행 환경마다 다르다).
 * `dist/main.js` 기준으로 한 단계 위가 `apps/api` 다.
 */
const API_ROOT = join(__dirname, '..')

@Module({
  imports: [
    // 🔴 .env 는 커밋되지 않는다. 로컬은 .env.local 을 쓴다.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(API_ROOT, '.env.local'), join(API_ROOT, '.env')],
    }),
    DiagnoseModule,
    ContactModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
