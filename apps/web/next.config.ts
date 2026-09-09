import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // 3D 청크는 초기 번들에 넣지 않는다 (기획서 4절 성능 예산).
  experimental: { optimizePackageImports: ['three'] },
}

export default config
