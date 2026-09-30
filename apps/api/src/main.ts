import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // 신뢰할 프록시 홉 수(web 프록시 1, 앞에 리버스 프록시·터널이 더 있으면 2). 꺼두면 모든 방문자가 프록시 IP 하나로 세어진다
  // trust proxy 에 true 금지 — X-Forwarded-For 위조로 IP 제한이 뚫린다
  app.set('trust proxy', Number(process.env.TRUSTED_PROXY_HOPS ?? 1))

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // CORS 를 켜지 않는다 — 브라우저는 web 프록시를 거쳐 같은 출처로만 부른다

  // ?? 가 아니라 || — .env 의 빈 값(API_PORT=)이 Number('') = 0 이 되어 랜덤 포트에 뜬다
  const port = Number(process.env.API_PORT || 3201)

  // API_DOCS=1 일 때만 연다. Swagger 는 Express 미들웨어라 내부 토큰 가드가 걸리지 않는다
  if (process.env.API_DOCS === '1') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('neighbor-dev api').build(),
    )
    SwaggerModule.setup('docs', app, doc)
  }

  // 운영은 같은 기계의 터널만 붙는다. 컨테이너 안에서만 API_HOST 로 넓힌다
  const host = process.env.API_HOST || '127.0.0.1'
  await app.listen(port, host)
  new Logger('bootstrap').log(`api 가 ${host}:${port} 에서 듣는다`)
}

void bootstrap()
