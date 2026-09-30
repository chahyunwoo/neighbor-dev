import { Controller, Get } from '@nestjs/common'

// 살아 있다는 사실만 답한다 — 공개 인터넷에 서므로 버전·호스트명·의존성 상태를 담지 않는다
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true }
  }
}
