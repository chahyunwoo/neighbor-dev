import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

// 길이 상한은 비용(입력 토큰 = 요금)과 프롬프트 주입 표면을 줄이려는 것
export class DiagnoseDto {
  @IsString()
  @MinLength(20, { message: '무엇을 만들고 싶은지 조금만 더 적어주세요 (20자 이상).' })
  @MaxLength(4000, { message: '4,000자 안쪽으로 적어주세요.' })
  requirement!: string

  // Cloudflare Turnstile 응답. api 에 TURNSTILE_SECRET 가 있으면 필수다
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string
}
