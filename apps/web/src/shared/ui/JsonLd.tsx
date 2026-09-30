// HTML 에 그대로 실리는 공개물이다 — 사명·개인 도메인·저장소 링크를 넣지 않는다. `<` 를 이스케이프해 </script> 탈출을 막는다.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD 는 이 방법뿐이고 위에서 이스케이프한다
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  )
}
