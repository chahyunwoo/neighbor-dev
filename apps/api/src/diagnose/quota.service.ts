import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * 남용 방지 2단 (기획서 5절).
 *
 * 🔴 **일일 총량 캡이 비용 방어의 본체다.** IP 제한만 두면 분산 요청에 선형으로
 *    늘어난다 — 전역 규칙 8절("각자 자기 몫만 줄이는 것은 근본 대응이 아니다 →
 *    총량을 상수로")과 같은 형태다.
 *
 * ⚠️ 인메모리다. 인스턴스가 여러 개면 캡이 인스턴스 수만큼 곱해진다 —
 *    이 사이트는 단일 인스턴스 전제이고, 늘릴 때는 공유 저장소로 옮겨야 한다.
 *    그 전제를 코드에 남겨두기 위해 `assertSingleInstance()` 를 둔다.
 */

/** 무엇에 대한 할당량인가. 서로의 예산을 깎지 않는다. */
export type QuotaScope = 'diagnose' | 'contact'

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; reason: 'daily-cap' | 'ip-hourly'; retryAfterSeconds: number }

const HOUR_MS = 60 * 60 * 1000

@Injectable()
export class QuotaService {
  private readonly log = new Logger(QuotaService.name)

  /**
   * 용도별 일일 사용량. 자정(KST)에 리셋한다.
   *
   * ⚠️ 용도를 나눈 이유: 자가진단과 문의가 같은 카운터를 쓰면, 진단을 많이 쓴
   *    날에 **문의가 막힌다.** 비용이 드는 쪽(모델 호출)과 안 드는 쪽(메일)을
   *    같은 예산으로 묶을 이유가 없다.
   */
  private readonly dailyCount = new Map<string, number>()
  private dailyResetAt: number

  /** `${scope}:${ip}` 별 최근 1시간 요청 시각. */
  private readonly ipHits = new Map<string, number[]>()

  private readonly dailyCap: number
  private readonly perIpHourly: number
  private readonly contactDailyCap: number
  private readonly contactPerIpHourly: number

  constructor(config: ConfigService) {
    // 기획서 5절: 월 $20 상한 ≈ 월 1,000건 → 하루 약 33건.
    // 값은 환경변수로 두되, 없으면 상한을 넘지 않는 보수적 기본값을 쓴다.
    this.dailyCap = Number(config.get('AI_DAILY_TOTAL_CAP') ?? 30)
    this.perIpHourly = Number(config.get('AI_RATE_LIMIT_PER_IP_HOUR') ?? 3)
    // 문의는 모델을 안 부르므로 비용이 아니라 스팸이 문제다. 넉넉히 두되 상한은 둔다.
    this.contactDailyCap = Number(config.get('CONTACT_DAILY_CAP') ?? 50)
    this.contactPerIpHourly = Number(config.get('CONTACT_RATE_LIMIT_PER_IP_HOUR') ?? 2)
    this.dailyResetAt = nextMidnightKst()
  }

  /**
   * 이 요청을 받아도 되는가. **소비는 하지 않는다** —
   * 실제로 모델을 부른 뒤 `consume()` 을 호출한다.
   *
   * 검사와 소비를 나눈 이유: 모델 호출이 실패했는데 할당량만 깎이면,
   * 방문자는 아무것도 못 받고 그날의 캡만 줄어든다.
   */
  check(ip: string, scope: QuotaScope = 'diagnose'): QuotaDecision {
    const now = Date.now()
    this.rolloverIfNeeded(now)
    const limits = this.limitsFor(scope)

    if ((this.dailyCount.get(scope) ?? 0) >= limits.daily) {
      return {
        allowed: false,
        reason: 'daily-cap',
        retryAfterSeconds: Math.ceil((this.dailyResetAt - now) / 1000),
      }
    }

    const key = `${scope}:${ip}`
    const hits = (this.ipHits.get(key) ?? []).filter((t) => now - t < HOUR_MS)
    if (hits.length >= limits.perIpHourly) {
      const oldest = hits[0] ?? now
      return {
        allowed: false,
        reason: 'ip-hourly',
        retryAfterSeconds: Math.ceil((oldest + HOUR_MS - now) / 1000),
      }
    }

    return { allowed: true }
  }

  /** 실제로 처리한 뒤에 호출한다. */
  consume(ip: string, scope: QuotaScope = 'diagnose'): void {
    const now = Date.now()
    this.rolloverIfNeeded(now)
    const limits = this.limitsFor(scope)
    const used = (this.dailyCount.get(scope) ?? 0) + 1
    this.dailyCount.set(scope, used)

    const key = `${scope}:${ip}`
    const hits = (this.ipHits.get(key) ?? []).filter((t) => now - t < HOUR_MS)
    hits.push(now)
    this.ipHits.set(key, hits)

    if (used === limits.daily) {
      // 캡에 닿은 순간을 남긴다 — 조용히 막히면 왜 안 되는지 아무도 모른다.
      this.log.warn(`${scope} 일일 캡 ${limits.daily}건에 도달했다. 자정까지 안내 문구로 전환된다.`)
    }
  }

  /** 화면에 남은 횟수를 보여줄 때 쓴다. */
  snapshot(scope: QuotaScope = 'diagnose') {
    this.rolloverIfNeeded(Date.now())
    const limits = this.limitsFor(scope)
    return {
      dailyCap: limits.daily,
      dailyUsed: this.dailyCount.get(scope) ?? 0,
      perIpHourly: limits.perIpHourly,
    }
  }

  private limitsFor(scope: QuotaScope) {
    return scope === 'contact'
      ? { daily: this.contactDailyCap, perIpHourly: this.contactPerIpHourly }
      : { daily: this.dailyCap, perIpHourly: this.perIpHourly }
  }

  private rolloverIfNeeded(now: number): void {
    if (now < this.dailyResetAt) return
    this.dailyCount.clear()
    this.dailyResetAt = nextMidnightKst()
    // 오래된 IP 기록도 같이 턴다 — 안 그러면 맵이 무한히 자란다.
    for (const [ip, hits] of this.ipHits) {
      const live = hits.filter((t) => now - t < HOUR_MS)
      if (live.length === 0) this.ipHits.delete(ip)
      else this.ipHits.set(ip, live)
    }
  }
}

/** 다음 자정(KST) 의 epoch ms. 서버 시간대와 무관하게 계산한다. */
export function nextMidnightKst(from: number = Date.now()): number {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  const kstNow = from + KST_OFFSET_MS
  const kstMidnight = Math.floor(kstNow / 86_400_000 + 1) * 86_400_000
  return kstMidnight - KST_OFFSET_MS
}
