import { IsString, MaxLength, MinLength } from 'class-validator'

/**
 * 방문자 입력. 경계에서 검증한다(전역 규칙: 외부 입력은 시스템 경계에서 검증).
 *
 * 길이 상한을 두는 이유는 두 가지다 — 비용(입력 토큰이 그대로 요금이다)과
 * 프롬프트 주입 표면. 4,000자면 요구사항을 적기에 충분하다.
 */
export class DiagnoseDto {
  @IsString()
  @MinLength(20, { message: '무엇을 만들고 싶은지 조금만 더 적어주세요 (20자 이상).' })
  @MaxLength(4000, { message: '4,000자 안쪽으로 적어주세요.' })
  requirement!: string
}
