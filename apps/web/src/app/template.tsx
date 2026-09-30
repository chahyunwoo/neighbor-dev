// 경로마다 다시 마운트되는 유일한 자리. 여기서 페이드를 걸지 않는다 — 서버 HTML 이 opacity:0 으로 나가고 VT 와 이중으로 걸린다.
export default function Template({ children }: { children: React.ReactNode }) {
  return children
}
