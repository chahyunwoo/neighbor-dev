/**
 * shared/ui — 어느 도메인에도 속하지 않는 표시 컴포넌트.
 *
 * 🔴 **세그먼트 단위로 노출한다**(`@/shared/ui`). `@/shared` 통짜 barrel 은
 *    쓰지 않는다 — 실측(FLW): 통짜 `from '@/shared'` 사용 0건, 전부
 *    `@/shared/components/ui`·`@/shared/lib/utils` 처럼 세그먼트로 부른다.
 *    통짜로 두면 무관한 모듈까지 한 파일에 묶여 순환 참조가 생기기 쉽다.
 */
export { RichText } from './RichText'
