/**
 * 이슈 #82 프로브 — **렌더된 HTML 에서** SEO 요소를 센다.
 *
 * 🔴 "설정했다" 를 믿지 않는다. `metadataBase` 가 없으면 Next 는 canonical·og:url 을
 *    **경고 없이 통째로 빼버린다.** 소스에 `alternates` 를 써놓고도 태그가 안 나간다.
 *    실측 2026-09-17: 그 상태로 있었고, 고친 뒤에도 하위 화면의 canonical 이
 *    전부 루트를 가리켰다(layout 의 값이 상속된다).
 *
 * 🔴 **canonical 이 자기 경로를 가리키는지까지 본다.** 존재 검사만 하면
 *    "전부 루트를 가리키는" 상태를 통과시킨다 — 그게 원래 버그였다.
 */
const { chromium, LAUNCH, BASE } = require('./_pw.cjs')

const PAGES = ['/', '/work', '/career', '/stack', '/team', '/contact', '/diagnose']

;(async () => {
  const b = await chromium.launch(LAUNCH)
  const fails = []

  // 1) robots.txt · sitemap.xml · og 이미지가 실제로 서빙되는가
  const ctx0 = await b.newContext()
  for (const [path, must] of [
    ['/robots.txt', 'Sitemap:'],
    ['/sitemap.xml', '<loc>'],
  ]) {
    const r = await ctx0.request.get(`${BASE}${path}`)
    const body = r.ok() ? await r.text() : ''
    if (!r.ok() || !body.includes(must)) {
      fails.push(`${path} — ${r.status()} / '${must}' ${body.includes(must) ? '있음' : '없음'}`)
    }
  }
  const og = await ctx0.request.get(`${BASE}/opengraph-image`)
  if (!og.ok() || !(og.headers()['content-type'] || '').startsWith('image/')) {
    fails.push(`/opengraph-image — ${og.status()} ${og.headers()['content-type']}`)
  }
  await ctx0.close()

  // 2) 화면마다 canonical·og 가 있고 **자기 경로**를 가리키는가
  console.log('화면          canonical                    og:title                       og:image')
  for (const p of PAGES) {
    const ctx = await b.newContext()
    const pg = await ctx.newPage()
    await pg.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' })
    const got = await pg.evaluate(() => ({
      canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? '',
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '',
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
      ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? '',
      jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
    }))
    const tail = (u) => {
      try {
        return new URL(u).pathname.replace(/\/$/, '') || '/'
      } catch {
        return ''
      }
    }
    const why = []
    if (!got.canonical) why.push('canonical 없음')
    else if (
      tail(got.canonical) !== p.replace(/\/$/, '') &&
      !(p === '/' && tail(got.canonical) === '/')
    )
      why.push(`canonical 이 ${tail(got.canonical)} 를 가리킨다`)
    if (!got.ogTitle) why.push('og:title 없음')
    if (!got.ogImage) why.push('og:image 없음')
    if (!got.ogUrl) why.push('og:url 없음')
    if (got.jsonLd === 0) why.push('JSON-LD 없음')
    if (why.length) fails.push(`${p} — ${why.join(' · ')}`)
    console.log(
      `${p.padEnd(13)} ${tail(got.canonical).padEnd(27)} ${got.ogTitle.slice(0, 28).padEnd(30)} ${got.ogImage ? '있음' : '🔴 없음'}`,
    )
    await ctx.close()
  }
  await b.close()

  if (fails.length) {
    console.log('')
    for (const f of fails) console.log(`🔴 ${f}`)
    process.exit(1)
  }
  console.log(`\n${PAGES.length}개 화면 — canonical·og·JSON-LD 전부 자기 것을 가리킨다`)
})()
