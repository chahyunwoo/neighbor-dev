/**
 * JSON-LD 구조화 데이터.
 *
 * 🔴 **여기 넣는 값은 전부 공개물이다.** 화면에 안 보이지만 HTML 에 그대로 실린다.
 *    클라이언트사명·개인 도메인·저장소 링크를 넣지 않는다(AGENTS.md 「공개 금지」).
 *    `verify-rendered.mjs` 가 렌더된 HTML 을 훑으므로 실수하면 그 검사에 걸린다.
 *
 * ⚠️ `dangerouslySetInnerHTML` 을 쓰되 `<` 를 이스케이프한다 — 문자열 안에
 *    `</script>` 가 들어가면 스크립트 태그가 거기서 닫혀 XSS 가 된다.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD 는 이 방법뿐이고 위에서 이스케이프한다
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  )
}
