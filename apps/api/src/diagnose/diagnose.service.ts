import Anthropic from '@anthropic-ai/sdk'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { checkOutput } from './diagnose.guard'
import { buildUserMessage, SYSTEM_PROMPT } from './diagnose.prompt'

/**
 * 상담 전 자가진단 (기획서 5절).
 *
 * 🔴 **아무것도 저장하지 않는다.** 방문자 입력도 결과도 로그에 남기지 않는다.
 *    개인정보 수집이 되는 순간 처리방침·동의·보관 기간이 전부 따라붙는다.
 *    로그에는 "몇 건 처리했는가" 만 남긴다.
 */
@Injectable()
export class DiagnoseService {
  private readonly log = new Logger(DiagnoseService.name)
  private readonly client: Anthropic | null
  private readonly model: string

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY')
    // 기획서 5절이 확정한 모델. 바꾸려면 그 절의 비용 산정을 다시 한다.
    this.model = config.get<string>('AI_MODEL') ?? 'claude-sonnet-5'
    this.client = apiKey ? new Anthropic({ apiKey }) : null
    if (!this.client) {
      this.log.warn('ANTHROPIC_API_KEY 가 없다. 자가진단은 준비 중으로 응답한다.')
    }
  }

  get available(): boolean {
    return this.client !== null
  }

  /**
   * 요구사항을 진단한다.
   * @throws ServiceUnavailableException 키가 없거나 출력이 게이트에 걸렸을 때
   */
  async diagnose(requirement: string): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException('자가진단은 아직 준비 중입니다.')
    }

    let response: Anthropic.Message
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        // 시스템 프롬프트는 고정이라 캐싱이 걸린다. 방문자 입력만 매번 바뀐다.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserMessage(requirement) }],
      })
    } catch (err) {
      // 🔴 SDK 예외를 그대로 흘리지 않는다. 그러면 500 "Internal server error" 가
      //    방문자에게 가고, 스택과 요청 내용이 로그에 통째로 남는다(실측
      //    2026-09-09: 인증 실패가 그대로 500 으로 샜다).
      //    우리 쪽 문제와 방문자 쪽 문제를 갈라 안내한다.
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

    // 🔴 프롬프트가 지켜졌다고 믿지 않는다. 출력에서 한 번 더 검사한다.
    const guard = checkOutput(text)
    if (!guard.ok) {
      // 걸린 대목은 로그에만. 방문자에게는 무엇이 걸렸는지 알리지 않는다.
      this.log.error(
        `AI 출력 게이트에 걸렸다: ${guard.violations.join(', ')} | ${guard.samples[0]}`,
      )
      throw new ServiceUnavailableException(
        '결과를 검토하는 과정에서 걸러졌습니다. 문의로 직접 말씀해 주시면 사람이 답변드리겠습니다.',
      )
    }

    // 입력도 출력도 남기지 않는다. 처리했다는 사실만.
    this.log.log(`자가진단 1건 처리 (${text.length}자)`)
    return text
  }

  /**
   * SDK 예외를 방문자에게 보여줄 수 있는 형태로 바꾼다.
   *
   * 🔴 원인은 로그에만 남긴다 — 인증 실패나 잔액 부족을 방문자가 알 이유가 없고,
   *    알리면 우리 운영 상태가 새어나간다.
   */
  private toFriendly(err: unknown): ServiceUnavailableException {
    if (err instanceof Anthropic.RateLimitError) {
      this.log.warn('모델 rate limit 에 걸렸다.')
      return new ServiceUnavailableException(
        '지금 요청이 몰려 있습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
    if (err instanceof Anthropic.AuthenticationError) {
      // 운영 사고다. 방문자에게는 그 사실을 알리지 않는다.
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
