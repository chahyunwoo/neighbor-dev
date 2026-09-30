import Anthropic from '@anthropic-ai/sdk'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { checkOutput } from './diagnose.guard'
import { buildUserMessage, SYSTEM_PROMPT } from './diagnose.prompt'

// 방문자 입력도 결과도 저장·로그하지 않는다. 처리 건수만 남긴다
@Injectable()
export class DiagnoseService {
  private readonly log = new Logger(DiagnoseService.name)
  private readonly client: Anthropic | null
  private readonly model: string

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY')
    // 모델을 바꾸면 비용 산정을 다시 한다
    this.model = config.get<string>('AI_MODEL') ?? 'claude-sonnet-5'
    this.client = apiKey ? new Anthropic({ apiKey }) : null
    if (!this.client) {
      this.log.warn('ANTHROPIC_API_KEY 가 없다. 자가진단은 준비 중으로 응답한다.')
    }
  }

  get available(): boolean {
    return this.client !== null
  }

  async diagnose(requirement: string): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException('자가진단은 아직 준비 중입니다.')
    }

    let response: Anthropic.Message
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        // 시스템 프롬프트는 고정이라 캐싱이 걸린다
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserMessage(requirement) }],
      })
    } catch (err) {
      // SDK 예외를 그대로 흘리지 않는다 — 500 과 요청 내용이 방문자·로그로 샌다
      throw this.toFriendly(err)
    }

    if (response.stop_reason === 'refusal') {
      throw new ServiceUnavailableException(
        '이 요청은 처리할 수 없습니다. 내용을 바꿔 다시 시도해 주세요.',
      )
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    if (text.length === 0) {
      throw new ServiceUnavailableException('결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }

    // 프롬프트가 지켜졌다고 믿지 않고 출력을 한 번 더 검사한다
    const guard = checkOutput(text)
    if (!guard.ok) {
      // 무엇에 걸렸는지는 로그에만
      this.log.error(
        `AI 출력 게이트에 걸렸다: ${guard.violations.join(', ')} | ${guard.samples[0]}`,
      )
      throw new ServiceUnavailableException(
        '결과를 검토하는 과정에서 걸러졌습니다. 문의로 직접 말씀해 주시면 사람이 답변드리겠습니다.',
      )
    }

    this.log.log(`자가진단 1건 처리 (${text.length}자)`)
    return text
  }

  // 게이트는 전체 텍스트를 봐야 해서 스트림 끝에 판정한다. 걸리면 ok:false 로 알려 화면이 지운다
  async diagnoseStream(
    requirement: string,
    onDelta: (text: string) => void,
  ): Promise<{ ok: boolean; text: string }> {
    if (!this.client) {
      throw new ServiceUnavailableException('자가진단은 아직 준비 중입니다.')
    }

    let text = ''
    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 2000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserMessage(requirement) }],
      })

      stream.on('text', (delta) => {
        text += delta
        onDelta(delta)
      })

      const final = await stream.finalMessage()
      if (final.stop_reason === 'refusal') {
        throw new ServiceUnavailableException(
          '이 요청은 처리할 수 없습니다. 내용을 바꿔 다시 시도해 주세요.',
        )
      }
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err
      throw this.toFriendly(err)
    }

    if (text.trim().length === 0) {
      throw new ServiceUnavailableException('결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }

    const guard = checkOutput(text)
    if (!guard.ok) {
      this.log.error(`AI 출력 게이트에 걸렸다: ${guard.violations.join(', ')} | ${guard.samples[0]}`)
      return { ok: false, text }
    }

    this.log.log(`자가진단 1건 처리 (${text.length}자, 스트리밍)`)
    return { ok: true, text }
  }

  // 원인은 로그에만 — 인증 실패·잔액 부족을 방문자에게 알리면 운영 상태가 샌다
  private toFriendly(err: unknown): ServiceUnavailableException {
    if (err instanceof Anthropic.RateLimitError) {
      this.log.warn('모델 rate limit 에 걸렸다.')
      return new ServiceUnavailableException(
        '지금 요청이 몰려 있습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
    if (err instanceof Anthropic.AuthenticationError) {
      this.log.error('ANTHROPIC_API_KEY 가 유효하지 않다. 자가진단이 멈춰 있다.')
      return new ServiceUnavailableException(
        '자가진단이 잠시 멈춰 있습니다. 문의로 직접 말씀해 주세요.',
      )
    }
    if (err instanceof Anthropic.APIError) {
      this.log.error(`모델 호출 실패 (status=${err.status})`)
      return new ServiceUnavailableException(
        '결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
    this.log.error(`알 수 없는 실패: ${err instanceof Error ? err.name : typeof err}`)
    return new ServiceUnavailableException('결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}
