/**
 * AI 자가진단 — 슬라이스 public API.
 *
 * 🔴 엔드포인트가 있는 도메인이라 `entities` 다
 *    (`apps/api` 의 `@Controller('diagnose')` · `@Post('stream')`).
 */
export {
  buildCopyText,
  isPeriodSection,
  isRiskSection,
  isScopeSection,
  type Period,
  parsePeriod,
  parseRiskLine,
  parseScopeLine,
  type RiskItem,
  type RiskLevel,
  type ScopeItem,
  type Section,
  splitSections,
} from './lib/diagnose-parse'
export { DiagnoseForm } from './ui/DiagnoseForm'
export { DiagnoseResult } from './ui/DiagnoseResult'
