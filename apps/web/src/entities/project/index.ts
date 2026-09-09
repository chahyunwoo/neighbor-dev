/**
 * 포트폴리오 항목 — 슬라이스 public API.
 *
 * ⚠️ 서버 CRUD 엔드포인트는 없다(빌드 타임에 생성된 JSON 하나를 읽는다).
 *    그래도 `entities` 에 두는 이유: 이 사이트의 **도메인 모델**이고,
 *    `features`·`widgets` 가 이 타입과 층 규칙(detail/summary)에 의존한다.
 *    `features` 에 두면 상위 레이어가 도메인을 소유하게 되어 의존이 뒤집힌다.
 */
export {
  type BaseProject,
  type Decision,
  type DetailProject,
  displayStack,
  getAllProjects,
  getCounts,
  getDetailProjects,
  getGeneratedAt,
  getProject,
  getStackFrequency,
  getSummaryProjects,
  type Metric,
  type Project,
  type SummaryProject,
} from './model/projects'
export { ProjectLens } from './ui/ProjectLens'
export { StackTags } from './ui/StackTags'
