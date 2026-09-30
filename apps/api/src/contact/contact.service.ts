import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport, type Transporter } from 'nodemailer'
import { QuotaService } from '../diagnose/quota.service'
import type { ContactDto } from './contact.dto'

// 저장하지 않고 메일로만 넘긴다. 로그에 이름·이메일·본문을 남기지 않는다
// SMTP 설정이 없으면 조용히 성공하지 않고 명시적으로 막는다 — 방문자는 보냈다고 믿게 된다
@Injectable()
export class ContactService {
  private readonly log = new Logger(ContactService.name)
  private readonly transporter: Transporter | null
  private readonly to: string | undefined
  private readonly from: string | undefined

  constructor(config: ConfigService, quota: QuotaService) {
    const host = config.get<string>('SMTP_HOST')
    const user = config.get<string>('SMTP_USER')
    const pass = config.get<string>('SMTP_PASS')
    this.to = config.get<string>('CONTACT_TO')
    this.from = config.get<string>('CONTACT_FROM') ?? user
    quota.onCapReached((scope, cap) => void this.alertCap(scope, cap))

    // 로컬 검증용 — 발송하지 않는다. 운영에서 켜지면 문의가 조용히 사라지므로 크게 경고한다
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
        // 방문자 주소는 replyTo 로만 — from 에 넣으면 SPF/DKIM 이 깨져 스팸으로 빠진다
        replyTo: `${dto.name} <${dto.email}>`,
        subject: `[문의] ${dto.name}`,
        text: buildBody(dto),
      })
    } catch (err) {
      // 원인은 로그에만. 방문자에게 SMTP 사정을 알리지 않는다
      this.log.error(`메일 발송 실패: ${failureCode(err)}`)
      throw new ServiceUnavailableException(
        '지금 접수가 되지 않습니다. 잠시 후 다시 시도해 주세요.',
      )
    }

    this.log.log('문의 1건 전달')
  }

  // 봇이 하루 몫을 먼저 소진했을 수 있다 — 조용히 막히면 운영자가 모른다
  private async alertCap(scope: string, cap: number): Promise<void> {
    if (!this.transporter || !this.to) return
    const label = scope === 'contact' ? '문의' : '자가진단'
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: this.to,
        subject: `[알림] ${label} 일일 한도 ${cap}건 도달`,
        text: `${label} 요청이 오늘 한도(${cap}건)에 닿아 자정(KST)까지 안내 문구로 응답합니다.\n평소보다 이르면 자동 요청을 의심해 api 로그를 확인하세요.`,
      })
    } catch (err) {
      this.log.error(`한도 알림 발송 실패: ${failureCode(err)}`)
    }
  }
}

// 원인 코드만 남긴다(EAUTH·EDNS 등). 메시지에는 주소·계정이 섞일 수 있다
function failureCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String((err as { code: unknown }).code)
  return err instanceof Error ? err.name : typeof err
}

function buildBody(dto: ContactDto): string {
  const parts = [
    `보낸 사람: ${dto.name} <${dto.email}>`,
    '',
    '─────────────────────',
    dto.message,
  ]
  return parts.join('\n')
}
