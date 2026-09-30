import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

// 일일 총량 캡이 비용 방어의 본체다 — IP 제한만으로는 분산 요청에 선형으로 는다
// 인메모리라 단일 인스턴스 전제다. 인스턴스를 늘리면 캡이 곱해지므로 공유 저장소로 옮겨야 한다

// 용도별로 예산을 따로 센다
export type QuotaScope = 'diagnose' | 'contact'

// 되돌릴 때 이 예약 하나만 지우도록 기간과 시각을 들고 다닌다
export type QuotaTicket = { scope: QuotaScope; ip: string; at: number; period: number }

type QuotaDenied = { allowed: false; reason: 'daily-cap' | 'ip-hourly'; retryAfterSeconds: number }
export type QuotaCheck = { allowed: true } | QuotaDenied
export type QuotaDecision = { allowed: true; ticket: QuotaTicket } | QuotaDenied

const HOUR_MS = 60 * 60 * 1000

// 빈 값(KEY=)·숫자 아님·0 이하는 기본값 — ?? 로 받으면 Number('') 가 0 이 되어 전부 막힌다
export function positiveOr(value: unknown, fallback: number): number {
  const n = Number(value)
  return value == null || !Number.isFinite(n) || n <= 0 ? fallback : n
}

@Injectable()
export class QuotaService {
  private readonly log = new Logger(QuotaService.name)

  // 자정(KST)에 리셋. 용도를 나눈다 — 한 카운터면 진단을 많이 쓴 날 문의가 막힌다
  private readonly dailyCount = new Map<string, number>()
  private dailyResetAt: number

  // `${scope}:${ip}` 별 최근 1시간 요청 시각
  private readonly ipHits = new Map<string, number[]>()

  private readonly dailyCap: number
  private readonly perIpHourly: number
  private readonly contactDailyCap: number
  private readonly contactPerIpHourly: number
  private capListener: ((scope: QuotaScope, cap: number) => void) | null = null

  constructor(config: ConfigService) {
    // 월 $20 상한 ≈ 하루 약 33건. 환경변수가 없으면 상한을 넘지 않는 보수적 기본값
    this.dailyCap = positiveOr(config.get('AI_DAILY_TOTAL_CAP'), 30)
    this.perIpHourly = positiveOr(config.get('AI_RATE_LIMIT_PER_IP_HOUR'), 3)
    // 문의는 모델을 안 부르므로 비용이 아니라 스팸 방어용 상한
    this.contactDailyCap = positiveOr(config.get('CONTACT_DAILY_CAP'), 50)
    this.contactPerIpHourly = positiveOr(config.get('CONTACT_RATE_LIMIT_PER_IP_HOUR'), 2)
    this.dailyResetAt = nextMidnightKst()
  }

  // 캡 도달을 사람에게 알리는 곳(메일)이 여기 없으므로 밖에서 건다. 하루에 용도별로 한 번 불린다
  onCapReached(listener: (scope: QuotaScope, cap: number) => void): void {
    this.capListener = listener
  }

  // 확인과 차감을 한 동기 호출에서 한다 — 나눠서 사이에 await 이 끼면 동시 요청이 전부 통과한다
  reserve(ip: string, scope: QuotaScope = 'diagnose'): QuotaDecision {
    const decision = this.check(ip, scope)
    if (!decision.allowed) return decision
    const at = this.consume(ip, scope)
    return { allowed: true, ticket: { scope, ip, at, period: this.dailyResetAt } }
  }

  // 비용이 들지 않은 실패(메일 발송 실패 등)만 되돌린다
  // 자정을 넘긴 예약은 이미 리셋된 카운터라 일일 수를 건드리지 않는다
  refund(ticket: QuotaTicket): void {
    this.rolloverIfNeeded(Date.now())
    const { scope, ip, at, period } = ticket
    if (period === this.dailyResetAt) {
      this.dailyCount.set(scope, Math.max(0, (this.dailyCount.get(scope) ?? 0) - 1))
    }
    const hits = this.ipHits.get(`${scope}:${ip}`)
    const i = hits ? hits.indexOf(at) : -1
    if (hits && i >= 0) hits.splice(i, 1)
  }

  check(ip: string, scope: QuotaScope = 'diagnose'): QuotaCheck {
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

  consume(ip: string, scope: QuotaScope = 'diagnose'): number {
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
      // 캡 도달을 남긴다 — 조용히 막히면 원인을 알 수 없다
      this.log.warn(`${scope} 일일 캡 ${limits.daily}건에 도달했다. 자정까지 안내 문구로 전환된다.`)
      this.capListener?.(scope, limits.daily)
    }
    return now
  }

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
    // 오래된 IP 기록도 턴다 — 안 그러면 맵이 무한히 자란다
    for (const [ip, hits] of this.ipHits) {
      const live = hits.filter((t) => now - t < HOUR_MS)
      if (live.length === 0) this.ipHits.delete(ip)
      else this.ipHits.set(ip, live)
    }
  }
}

// 서버 시간대와 무관하게 다음 자정(KST)의 epoch ms 를 계산한다
export function nextMidnightKst(from: number = Date.now()): number {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  const kstNow = from + KST_OFFSET_MS
  const kstMidnight = Math.floor(kstNow / 86_400_000 + 1) * 86_400_000
  return kstMidnight - KST_OFFSET_MS
}
