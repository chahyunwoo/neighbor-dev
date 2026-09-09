# 여러 라우트가 함께 쓰는 페이지 스타일

🔴 원래 `app/work/page.module.css` · `app/contact/page.module.css` 였는데,
`app/career` 와 `app/diagnose` 가 **남의 라우트 폴더를 상대경로로 참고**하고 있었다
(`from '../work/page.module.css'`). 라우트끼리 서로를 아는 구조라 한쪽을 옮기면
다른 쪽이 조용히 깨진다.

둘 이상이 쓰는 것은 소유자를 두지 않고 `shared` 로 올린다(FSD 단방향 의존).

- `list-page.module.css` — 목록·카드 그리드 화면 (`/work`, `/career`)
- `form-page.module.css` — 폼 화면 (`/contact`, `/diagnose`)
