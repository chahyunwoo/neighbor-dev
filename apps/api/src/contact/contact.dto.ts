import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

/**
 * 문의 입력. 경계에서 검증한다.
 *
 * 🔴 받는 항목을 최소로 둔다 — 개인정보는 적게 받을수록 좋다.
 *
 * ⚠️ 자가진단 결과는 **받지 않는다**(2026-09-09 사용자 확정). 메일은 문의
 *    정보만 담는다. 진단 결과는 화면에서 보고 끝내고, 필요하면 방문자가
 *    본문에 직접 복사해 넣는다 — 우리가 자동으로 실어 보내지 않는다.
 *    연락처는 이메일 하나만 받고, 회사명·전화번호는 묻지 않는다.
 *    필요하면 답장에서 물어보면 된다.
 */
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
}
