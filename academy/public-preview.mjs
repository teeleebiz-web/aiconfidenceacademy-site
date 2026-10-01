import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const publicSections = new Set([
  'about', 'accessibility', 'ai-learning-disclaimer', 'assets', 'contact',
  'enroll', 'explore', 'faq', 'library', 'privacy', 'programs', 'reflections',
  'refund-policy', 'terms', 'videos',
])
const rootFiles = new Set(['index.html', 'site.js', 'favicon.svg', 'aca-official-seal.png'])
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
  '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8',
}

// The review deployment has no course database credentials. Serve only the
// public site presentation there; learner pages and APIs remain unavailable.
export async function servePublicPreview(request, response, route, root = resolve('private-dist')) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return
  }
  let path
  try { path = decodeURIComponent('/' + String(route ?? '').replace(/^\/+/, '')) }
  catch { response.writeHead(400); response.end(); return }
  if (path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) {
    response.writeHead(404); response.end(); return
  }
  const name = path === '/' ? 'index.html' : path.slice(1) + (path.endsWith('/') ? 'index.html' : !extname(path) ? '/index.html' : '')
  const first = name.split('/')[0]
  if (!(rootFiles.has(name) || publicSections.has(first)) || !mime[extname(name)]) {
    response.writeHead(404); response.end(); return
  }
  const file = resolve(root, name)
  if (!file.startsWith(resolve(root) + sep)) { response.writeHead(404); response.end(); return }
  try {
    const body = await readFile(file)
    response.writeHead(200, { 'Content-Type': mime[extname(name)] })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 503)
    response.end(error.code === 'ENOENT' ? 'Page not found.' : 'Preview temporarily unavailable.')
  }
}
