# apps/api 는 Biome 검사 대상이 아니다 — 2026-09-09

## 이유: Biome 파서가 NestJS 의 파라미터 데코레이터를 못 읽는다

```
apps/api/src/diagnose/diagnose.controller.ts:26:18 parse
  × Decorators are not valid here.
  > 26 │   async diagnose(@Body() dto: DiagnoseDto, @Ip() ip: string) {
  i Decorators are only valid on class declarations, class expressions, and class methods.
```

`@Body()`·`@Ip()` 는 NestJS 컨트롤러의 기본 문법인데 Biome 2.5 파서가 거부한다.
**규칙이 아니라 파서 한계라 `linter.rules` 로 끌 수 없다.**

→ `biome.json` 의 `files.includes` 에서 `apps/api/**` 를 뺐다.
→ api 의 타입 검사는 `tsc` 가 한다: `pnpm --filter @neighbor/api typecheck`

## 🔴 그 전에 Biome 자동 수정이 api 를 통째로 죽였다

이 결정의 계기는 파서 오류가 아니라 **실제 사고**다.

`biome check --write` 가 NestJS 주입 대상의 import 를 `import type` 으로 바꿨다:

```diff
-import { ConfigService } from '@nestjs/config'
+import type { ConfigService } from '@nestjs/config'
```

NestJS 는 **런타임 타입 메타데이터**로 의존성을 주입한다. `import type` 은 그
메타데이터를 지우므로 주입이 깨진다 — 그런데 **빌드는 초록이었다.**

```
ERROR [ExceptionHandler] UnknownDependenciesException:
  Nest can't resolve dependencies of the DiagnoseController (?, Function).
```

파일 5개 중 5개가 바뀌었고, api 는 기동조차 못 했다. `pnpm build` 는 통과했다 —
**"빌드가 초록이다" 와 "서비스가 뜬다" 는 다르다.**

→ api 를 고친 뒤에는 **반드시 실제로 띄워서** `/diagnose/status` 를 찍는다:

```bash
pnpm --filter @neighbor/api build
node apps/api/dist/main.js &
curl -s http://localhost:3100/diagnose/status
```
