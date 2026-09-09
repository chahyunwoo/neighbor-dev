/**
 * Tailwind 4 는 PostCSS 플러그인이 별도 패키지다(@tailwindcss/postcss).
 * 3.x 의 `tailwindcss` 를 여기 쓰면 기동하지 않는다.
 */
const config = {
  plugins: { '@tailwindcss/postcss': {} },
}
export default config
