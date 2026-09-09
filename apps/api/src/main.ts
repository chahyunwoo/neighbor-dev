import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

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
