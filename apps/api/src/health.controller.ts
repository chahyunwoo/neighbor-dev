import { Controller, Get } from '@nestjs/common'

/**
 * 헬스체크 — 배포가 초록인 것과 서비스가 사는 것은 다르다.
 *
 * 🔴 전역 규칙 3절: "배포 성공 ≠ 서비스 정상". `up -d` 는 기동을 기다리지
 *    않으므로 컨테이너가 기동 직후 죽어도 파이프라인은 초록으로 보인다.
 *    프로세스 관리자와 배포 스크립트가 이 엔드포인트를 실제로 찔러야
 *    "떴다" 를 말할 수 있다.
 *
 * ⚠️ **운영 상태를 흘리지 않는다.** 버전·호스트명·의존성 상태를 담지 않는다 —
 *    이 api 는 공개 인터넷에 선다(기획서 8절 B안). 살아 있다는 사실만 답한다.
 *    기능이 실제로 되는지는 `/diagnose/status`·`/contact/status` 가 답하고,
 *    그쪽은 키 유무만 불리언으로 준다.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true }
  }
}
