// 엔드포인트는 없지만 entities 다 — 이 사이트의 도메인 모델이고 상위 레이어가 타입과 층 규칙에 의존한다.
export {
  type BaseProject,
  type Brief,
  type Decision,
  type DetailProject,
  displayStack,
  getAllProjects,
  getCounts,
  getDetailProjects,
  getProject,
  getStackFrequency,
  getSummaryProjects,
  type Metric,
  type Project,
  type SummaryProject,
} from './model/projects'
export { ProjectLens } from './ui/ProjectLens'
export { StackTags } from './ui/StackTags'
