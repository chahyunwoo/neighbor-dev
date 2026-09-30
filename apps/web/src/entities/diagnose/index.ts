// 엔드포인트가 있는 도메인이라 entities 다(api `@Controller('diagnose')`).
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
