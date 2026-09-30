import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

// 개인정보는 최소로 받는다 — 진단 결과·회사명·전화번호는 받지 않는다
export class ContactDto {
  @IsString()
  @MinLength(2, { message: '어떻게 부르면 될지 알려주세요.' })
  @MaxLength(60, { message: '이름이 너무 깁니다.' })
  name!: string

  @IsEmail({}, { message: '답장을 보낼 수 있는 이메일 주소를 적어주세요.' })
  @MaxLength(160)
  email!: string

  @IsString()
  @MinLength(20, { message: '무엇을 만들고 싶은지 조금만 더 적어주세요 (20자 이상).' })
  @MaxLength(8000, { message: '8,000자 안쪽으로 적어주세요.' })
  message!: string

  // Cloudflare Turnstile 응답. api 에 TURNSTILE_SECRET 가 있으면 필수다
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string
}
