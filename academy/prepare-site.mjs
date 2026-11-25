import { cp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { preparePublicSite, protectedLessonAsset } from './public-site.mjs'
import { videoCatalog } from './email/newsletter.mjs'
const pages = ['', 'ask', 'about', 'accessibility', 'ai-learning-disclaimer', 'contact', 'enroll', 'explore', 'explore/what-working-with-ai-has-taught-me', 'faq', 'library', 'library/ai-updates', 'privacy', 'programs', 'programs/phase-one', 'programs/phase-two', 'reflections', 'refund-policy', 'terms', 'videos']
const privateMedia = process.env.ACA_PRIVATE_PHASE_TWO_MEDIA === 'true'
const publicSite = process.env.ACA_PUBLIC_SITE === 'true'
await rm('vercel-public', { recursive: true, force: true })
// Only crawler instructions are public; website files stay behind the password gate.
await mkdir('vercel-public', { recursive: true })
await writeFile('vercel-public/robots.txt', 'User-agent: *\nDisallow: /\n')
for (const page of pages) {
  const source = page ? `${page}/index.html` : 'index.html'
  const target = page ? `private-dist/${page}` : 'private-dist'
  await mkdir(target, { recursive: true })
  const html = (await readFile(source, 'utf8')).replace('<a href="/learn/">Learner sign in</a>', '<a href="/academy/phase-one/">Phase One</a>')
  await writeFile(`${target}/index.html`, html)
}
const hub = JSON.parse(await readFile('content/public-hub.json', 'utf8'))
await writeFile('private-dist/newsletter-catalog.json', JSON.stringify([
  ...videoCatalog(await readFile('videos/index.html','utf8')),
  ...hub.books.map(item=>({id:`book:${item.slug}`,title:item.title,url:`https://aiconfidenceacademy.org/library/${item.slug}/`,kind:'book'})),
  ...hub.articles.map(item=>({id:`resource:${item.slug}`,title:item.title,url:`https://aiconfidenceacademy.org/explore/${item.slug}/`,kind:'resource'})),
  ...hub.updates.map(item=>({id:`note:${item.slug}`,title:item.title,url:`https://aiconfidenceacademy.org/explore/updates/${item.slug}/`,kind:'note',category:item.newsletter_category || 'ACA updates'})),
]))
for (const [section, entries] of [['explore', hub.articles], ['library', hub.books]]) {
  for (const { slug } of entries) {
    const html = await readFile(`${section}/${slug}/index.html`, 'utf8')
    await mkdir(`private-dist/${section}/${slug}`, { recursive: true })
    await writeFile(`private-dist/${section}/${slug}/index.html`, html.replace('<a href="/learn/">Learner sign in</a>', '<a href="/academy/phase-one/">Phase One</a>'))
  }
}
for (const { slug } of hub.updates) {
  const html = await readFile(`explore/updates/${slug}/index.html`, 'utf8')
  await mkdir(`private-dist/explore/updates/${slug}`, { recursive: true })
  await writeFile(`private-dist/explore/updates/${slug}/index.html`, html.replace('<a href="/learn/">Learner sign in</a>', '<a href="/academy/phase-one/">Phase One</a>'))
}
await rm('private-dist/assets', { recursive: true, force: true })
await cp('assets', 'private-dist/assets', { recursive: true, filter: source => {
  if (publicSite) return ['assets','assets/videos'].includes(source) || (protectedLessonAsset(source) && (!/\.[^/]+$/.test(source) || source.endsWith('.json')))
  return !privateMedia || !protectedLessonAsset(source) || !/\.[^/]+$/.test(source) || source.endsWith('.json')
} })
for (const section of ['learn','control-center']) {
  await rm(`private-dist/${section}`, { recursive: true, force: true })
  if (!publicSite) await cp(section, `private-dist/${section}`, { recursive: true })
}
await cp('site.js', 'private-dist/site.js')
for(const file of ['support.js','support.css','support-knowledge.js']) await cp(file, `private-dist/${file}`)
for (const file of await readdir('.')) {
  if (/\.(png|svg|jpg|jpeg|webp|ico|pdf)$/.test(file)) await cp(file, `private-dist/${file}`)
}
await preparePublicSite({ pages: [...pages, ...hub.articles.map(({slug}) => `explore/${slug}`), ...hub.books.map(({slug}) => `library/${slug}`), ...hub.updates.map(({slug}) => `explore/updates/${slug}`)], enabled: publicSite, privateMedia })
