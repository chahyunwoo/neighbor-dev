import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  /**
   * 🔴 프록시 뒤에서 방문자 IP 를 되찾는다.
   *
   * 이 api 는 앞에 프록시(web 의 Route Handler, 그 앞의 리버스 프록시)를 두고
   * 선다. `trust proxy` 가 꺼져 있으면 Express 의 `req.ip` 가 **프록시의 IP**
   * 하나로 고정되고, `@Ip()` 로 그것을 받는 쿼터는 **모든 방문자를 한 명으로
   * 센다** — IP 시간당 제한이 통째로 죽는다.
   *
   * 실측 2026-09-09: `X-Forwarded-For` 를 5개 다르게 보냈는데 3건에서 막혔다
   * (제한값이 3). 다섯 IP 가 한 명으로 세어진 것이다. 로컬에서는 무해하지만
   * 배포하면 전 세계 방문자가 한 통에 담긴다.
   *
   * ⚠️ 값은 **신뢰할 프록시 홉 수**다. `true`(무조건 신뢰)로 두지 않는다 —
   *    그러면 아무나 `X-Forwarded-For` 를 위조해 제한을 우회한다.
   *    우리 구성은 web 프록시 1홉이 기본이고, 앞에 리버스 프록시를 하나 더
   *    두면 2가 된다. 환경변수로 조절한다.
   *
   * 확인: 서로 다른 X-Forwarded-For 로 제한값+1 번 호출해 마지막만 막히는가.
   */
  app.set('trust proxy', Number(process.env.TRUSTED_PROXY_HOPS ?? 1))

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // 🔴 CORS 를 켜지 않는다. 브라우저는 api 를 직접 부르지 않고 web 의 프록시
  //    (apps/web/src/app/api/diagnose/route.ts)를 거친다 — api 주소가 화면에
  //    박히지 않게 하려는 것이고, 그 결과 같은 출처가 되어 CORS 가 불필요하다.
  //    CORS 를 켜면 "브라우저가 직접 불러도 된다" 는 신호가 되어 그 설계가 흐려진다.

  // 포트: 이 맥의 8080·8090 은 다른 프로젝트가 쓴다. 3100 을 쓴다.
  const port = Number(process.env.API_PORT ?? 3100)
  await app.listen(port)
  new Logger('bootstrap').log(`api 가 ${port} 에서 듣는다`)
}

void bootstrap()
