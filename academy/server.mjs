import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const digest = value => createHash('sha256').update(value).digest()
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf' }
export function createAcademyServer({ password, root, db, courseId }) {
  if (!password || password.length < 24) throw new Error('A construction password of at least 24 characters is required.')
  if (!courseId) throw new Error('The Phase One course ID is required.')
  const expected = digest('academy:' + password)
  const publicRoot = resolve(root)
  async function curriculum() {
    const results = await Promise.all([
      db.from('courses').select('id,code,title,summary').eq('id', courseId).single(),
      db.from('course_journeys').select('id,course_id,journey_number,week_number,title,promise,status').eq('course_id', courseId).neq('status', 'archived').order('journey_number'),
      db.from('lessons').select('id,course_id,journey_id,page_id,title,purpose,estimated_minutes,course_position,journey_position,status,content').eq('course_id', courseId).neq('status', 'archived').order('course_position'),
    ])
    if (results.some(r => r.error)) throw new Error('Curriculum query failed')
    const [course, journeys, lessons] = results.map(r => r.data)
    const introductions = journeys.length ? await db.from('journey_introductions').select('id,journey_id,media_kind,media_path,caption_path,companion_audio_path,companion_caption_path,duration_seconds,content,status,source_version').in('journey_id', journeys.map(j => j.id)).neq('status', 'archived') : { data: [], error: null }
    if (introductions.error) throw new Error('Introduction query failed')
    return { course, journeys, lessons, introductions: introductions.data }
  }
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Strict-Transport-Security', 'max-age=31536000')
    const header = req.headers.authorization || ''
    const supplied = header.startsWith('Basic ') ? Buffer.from(header.slice(6), 'base64').toString() : ''
    if (!timingSafeEqual(digest(supplied), expected)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="ACA construction review", charset="UTF-8"' })
      res.end('This website is private during construction.'); return
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return }
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      if (path === '/api/academy/phase-one' || path.startsWith('/api/academy/welcome/') || path.startsWith('/api/academy/lesson-audio/')) {
        const data = await curriculum()
        if (path.startsWith('/api/academy/lesson-audio/')) {
          const lesson = data.lessons.find(l => l.id === path.slice('/api/academy/lesson-audio/'.length))
          const name = lesson?.content?.audio_path
          if (!name || typeof name !== 'string') { res.writeHead(404); res.end(); return }
          const { data: signed, error } = await db.storage.from('aca-learning-media').createSignedUrl(name, 3600)
          if (error || !signed?.signedUrl) throw new Error('Lesson audio unavailable')
          res.writeHead(302, { Location: signed.signedUrl }); res.end(); return
        }
        let result = data
        if (path.startsWith('/api/academy/welcome/')) {
          const introduction = data.introductions.find(i => i.id === path.slice('/api/academy/welcome/'.length))
          if (!introduction) { res.writeHead(404); res.end(); return }
          const sign = async name => {
            if (!name) return null
            const { data: signed, error } = await db.storage.from('aca-learning-media').createSignedUrl(name, 3600)
            if (error) throw new Error('Media unavailable')
            return signed.signedUrl
          }
          const [mediaUrl, captionUrl, companionAudioUrl, companionCaptionUrl] = await Promise.all([introduction.media_path, introduction.caption_path, introduction.companion_audio_path, introduction.companion_caption_path].map(sign))
          result = { introduction, mediaUrl, captionUrl, companionAudioUrl, companionCaptionUrl }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(req.method === 'HEAD' ? undefined : JSON.stringify(result)); return
      }
      if (path.startsWith('/api/')) { res.writeHead(404); res.end(); return }
      const file = resolve(publicRoot, '.' + path + (path.endsWith('/') ? 'index.html' : !extname(path) ? '/index.html' : ''))
      if (!file.startsWith(publicRoot + sep) || !types[extname(file)]) { res.writeHead(404); res.end(); return }
      const body = await readFile(file)
      res.writeHead(200, { 'Content-Type': types[extname(file)] }); res.end(req.method === 'HEAD' ? undefined : body)
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 503, { 'Content-Type': 'text/plain' })
      res.end(error.code === 'ENOENT' ? 'Page not found.' : 'The academy is temporarily unavailable. Please try again.')
    }
  })
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Server-side database configuration is required.')
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  createAcademyServer({ password: process.env.ACA_CONSTRUCTION_PASSWORD, root: resolve('private-dist'), db, courseId: process.env.ACA_PHASE_ONE_COURSE_ID }).listen(Number(process.env.PORT || 3000), '0.0.0.0')
}
