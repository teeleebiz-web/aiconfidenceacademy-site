import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'

export const protectedLessonAsset = path => /(^|\/)assets\/videos\/phase-two-lesson-[^/]+(?:\/|$)/i.test(path.replaceAll('\\', '/'))

export async function assertNoPaidIntroductions(directory) {
  const catalog = JSON.parse(await readFile(new URL('./phase-two-introductions.json', import.meta.url), 'utf8'))
  const fingerprints = Object.values(catalog).flatMap(group => Object.values(group)).flatMap(text =>
    text.split('\n').filter(line => line.trim().length >= 80).slice(0, 3).map(line => line.trim().slice(0, 100)))
  if (fingerprints.length < 15) throw new Error('Private introduction boundary catalog is incomplete')
  async function inspect(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name)
      if (entry.isDirectory()) await inspect(file)
      else if (/\.(js|html|json)$/.test(entry.name)) {
        const content = await readFile(file, 'utf8')
        if (fingerprints.some(value => content.includes(value) || content.includes(JSON.stringify(value).slice(1, -1)))) {
          throw new Error('Public portal output contains protected introduction text')
        }
      }
    }
  }
  await inspect(directory)
}

export async function copyPublicPortal(source, target) {
  const manifest = JSON.parse(await readFile(join(source, '.vite/manifest.json'), 'utf8'))
  const files = new Set(['index.html'])
  for (const entry of Object.values(manifest)) for (const file of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
    if (typeof file !== 'string' || file.startsWith('/') || file.split('/').includes('..') || file.includes('\\')) throw new Error('Unsafe portal build manifest')
    files.add(file)
  }
  await mkdir(target, { recursive: true })
  for (const file of files) { await mkdir(resolve(target, file, '..'), { recursive: true }); await cp(join(source, file), join(target, file)) }
  await assertNoPaidIntroductions(target)
}

export async function preparePublicSite({ root = '.', output = 'vercel-public', pages, enabled, privateMedia }) {
  if (!enabled) return
  if (!privateMedia) throw new Error('Public hosting requires protected Phase Two media first')
  const destination = resolve(output)
  for (const page of pages) {
    if (page.startsWith('/') || page.split('/').includes('..')) throw new Error('Invalid public page')
    const file = page ? page + '/index.html' : 'index.html'
    await mkdir(join(destination, page), { recursive: true })
    await cp(join(root, file), join(destination, file))
  }
  await cp(join(root, 'assets'), join(destination, 'assets'), { recursive: true, filter: source => !protectedLessonAsset(relative(root, source)) })
  for (const file of ['site.js', 'support.js', 'support.css', 'support-knowledge.js', 'favicon.svg', 'aca-official-seal.png']) await cp(join(root, file), join(destination, file))
  for (const file of await readdir(root)) if (/\.(png|svg|jpg|jpeg|webp|ico)$/.test(file)) await cp(join(root, file), join(destination, file))
  await copyPublicPortal(join(root, 'learn'), join(destination, 'learn'))
  await mkdir(join(destination, 'control-center'), { recursive: true })
  await cp(join(root, 'control-center/index.html'), join(destination, 'control-center/index.html'))
  // No source trees, backup inventory, construction app, or historic bundles are published.
  await writeFile(join(destination, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /learn/\nDisallow: /control-center/\n')
}
