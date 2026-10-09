import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { videoCatalog } from './email/newsletter.mjs'
const pages = ['', 'about', 'accessibility', 'ai-learning-disclaimer', 'contact', 'enroll', 'explore', 'faq', 'library', 'privacy', 'programs', 'reflections', 'refund-policy', 'terms', 'videos']
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
await cp('assets', 'private-dist/assets', { recursive: true })
await cp('learn', 'private-dist/learn', { recursive: true })
await cp('site.js', 'private-dist/site.js')
for (const file of await readdir('.')) {
  if (/\.(png|svg|jpg|jpeg|webp|ico|pdf)$/.test(file)) await cp(file, `private-dist/${file}`)
}
