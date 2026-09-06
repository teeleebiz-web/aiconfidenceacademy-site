import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
const pages = ['', 'about', 'accessibility', 'ai-learning-disclaimer', 'contact', 'enroll', 'faq', 'library', 'privacy', 'programs', 'reflections', 'refund-policy', 'terms', 'videos']
// Public output is deliberately empty: all website bytes go through the password gate.
await mkdir('vercel-public', { recursive: true })
for (const page of pages) {
  const source = page ? `${page}/index.html` : 'index.html'
  const target = page ? `private-dist/${page}` : 'private-dist'
  await mkdir(target, { recursive: true })
  const html = (await readFile(source, 'utf8')).replace('<a href="/learn/">Learner sign in</a>', '<a href="/academy/phase-one/">Phase One</a>')
  await writeFile(`${target}/index.html`, html)
}
await cp('assets', 'private-dist/assets', { recursive: true })
for (const file of await readdir('.')) {
  if (/\.(png|svg|jpg|jpeg|webp|ico|pdf)$/.test(file)) await cp(file, `private-dist/${file}`)
}
