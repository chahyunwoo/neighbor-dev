import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport, type Transporter } from 'nodemailer'
import type { ContactDto } from './contact.dto'

/**
 * 문의를 메일로 넘긴다.
 *
 * 🔴 **저장하지 않는다.** DB 도 파일도 없다 — 메일로 넘기고 끝낸다.
 *    저장하는 순간 보관 기간·파기 절차·유출 책임이 따라붙는데,
 *    문의를 읽고 답장하는 데 그것들이 필요하지 않다.
 *
 * 🔴 **로그에 내용을 남기지 않는다.** 이름·이메일·본문 어느 것도 찍지 않는다.
 *    "몇 건 처리했는가" 만 남긴다 — 자가진단과 같은 원칙이다.
 *
 * ⚠️ SMTP 설정이 없으면 조용히 성공하지 않는다. 그러면 방문자는 보냈다고
 *    믿는데 아무 데도 도착하지 않는다 — 가장 나쁜 실패다. 명시적으로 막는다.
 */
@Injectable()
export class ContactService {
  private readonly log = new Logger(ContactService.name)
  private readonly transporter: Transporter | null
  private readonly to: string | undefined
  private readonly from: string | undefined

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST')
    const user = config.get<string>('SMTP_USER')
    const pass = config.get<string>('SMTP_PASS')
    this.to = config.get<string>('CONTACT_TO')
    this.from = config.get<string>('CONTACT_FROM') ?? user

    // 로컬 개발·검증용. 실제로 나가지 않고 메일 본문만 만들어 낸다.
    // 🔴 운영에서 켜지면 문의가 조용히 사라진다 — 로그로 크게 남긴다.
    if (config.get('CONTACT_DRY_RUN') === 'true' && this.to) {
      this.transporter = createTransport({ streamTransport: true, buffer: true })
      this.log.warn('CONTACT_DRY_RUN 이 켜져 있다. 문의가 실제로 발송되지 않는다.')
      return
    }

    if (!host || !user || !pass || !this.to) {
      this.transporter = null
      this.log.warn('SMTP 설정이 없다. 문의는 준비 중으로 응답한다.')
      return
    }

    this.transporter = createTransport({
      host,
      port: Number(config.get('SMTP_PORT') ?? 587),
      secure: config.get('SMTP_SECURE') === 'true',
      auth: { user, pass },
    })
  }

  get available(): boolean {
    return this.transporter !== null
  }

  async send(dto: ContactDto): Promise<void> {
    if (!this.transporter || !this.to) {
      throw new ServiceUnavailableException('문의 접수는 아직 준비 중입니다.')
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: this.to,
        // 🔴 방문자가 적은 주소를 replyTo 로만 쓴다. from 에 넣으면
        //    SPF/DKIM 이 깨져 스팸으로 분류되고, 그러면 문의가 조용히 사라진다.
        replyTo: `${dto.name} <${dto.email}>`,
        subject: `[문의] ${dto.name}`,
        text: buildBody(dto),
      })
    } catch (err) {
      // 원인은 로그에만. 방문자에게 SMTP 사정을 알리지 않는다.
      this.log.error(`메일 발송 실패: ${err instanceof Error ? err.name : typeof err}`)
      throw new ServiceUnavailableException(
        '지금 접수가 되지 않습니다. 잠시 후 다시 시도해 주세요.',
      )
    }

    // 내용은 남기지 않는다. 처리했다는 사실만.
    this.log.log('문의 1건 전달')
  }
}

/** 메일 본문. 사람이 읽을 순서로 짠다. */
function buildBody(dto: ContactDto): string {
  const parts = [
    `보낸 사람: ${dto.name} <${dto.email}>`,
    '',
    '─────────────────────',
    dto.message,
  ]
  return parts.join('\n')
}
