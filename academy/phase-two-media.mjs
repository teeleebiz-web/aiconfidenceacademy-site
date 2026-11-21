import { readFile } from 'node:fs/promises'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const inventory = JSON.parse(await readFile(new URL('../operations/phase-two-media-inventory.json', import.meta.url), 'utf8'))
const introductions = JSON.parse(await readFile(new URL('./phase-two-introductions.json', import.meta.url), 'utf8'))

export function phaseTwoMediaFiles(pageId) {
  if (!/^[1-6]\.[1-6]$/.test(pageId)) throw new Error('Invalid lesson')
  const prefix = `assets/videos/phase-two-lesson-${pageId.replace('.', '-')}/`
  const files = inventory.files.filter(file => file.path.startsWith(prefix))
  if (!files.length || files.some(file => !/^[a-zA-Z0-9_.-]+$/.test(file.path.slice(prefix.length)))) throw new Error('Invalid media inventory')
  return files.map(file => ({ ...file, object: `phase-two/lessons/${pageId.replace('.', '-')}/${file.path.slice(prefix.length)}` }))
}

export async function signPhaseTwoMedia(db, pageId, remainingSeconds, started = Date.now()) {
  const ttl = Math.min(900, Math.floor(remainingSeconds)) - Math.max(1, Math.ceil((Date.now() - started) / 1000))
  if (!Number.isSafeInteger(ttl) || ttl <= 0) throw new Error('Lesson window closed')
  const files = phaseTwoMediaFiles(pageId)
  const result = await db.storage.from('aca-learning-media').createSignedUrls(files.map(file => file.object), ttl)
  if (result.error || !Array.isArray(result.data) || result.data.length !== files.length) throw new Error('Private media unavailable')
  const byObject = new Map(result.data.map(item => [item.path, item]))
  const signed = Object.fromEntries(files.map(file => {
    const item = byObject.get(file.object)
    if (item?.error || !item?.signedUrl || !item.signedUrl.startsWith('https://')) throw new Error('Private media unavailable')
    return ['/' + file.path, item.signedUrl]
  }))
  // Conservative expiry: never add network latency to a learner's remaining time.
  return { files: signed, expiresAt: new Date(started + ttl * 1000).toISOString(), introductions: {
    ...(introductions.original[pageId] ? { original: introductions.original[pageId] } : {}),
    ...(introductions.revised[pageId] ? { revised: introductions.revised[pageId] } : {}),
  } }
}

// Read-only authorization: this endpoint never opens a lesson or starts a timer.
export async function handlePhaseTwoMedia(req, res, { db, courseId, lessonId, enabled = false, accessCheck, reviewerCheck }) {
  const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(body)) }
  if (req.method !== 'GET') return reply(405, { error: 'Method not allowed.' })
  if (!enabled) return reply(503, { error: 'Private lesson media is not yet available.' })
  if (!uuid.test(lessonId || '') || !uuid.test(courseId || '')) return reply(404, { error: 'Unavailable' })
  try {
    const token = req.headers['x-aca-access-token']
    if (typeof token !== 'string' || !token) return reply(401, { error: 'Please sign in.' })
    const user = await db.auth.getUser(token)
    if (user.error || !user.data?.user || user.data.user.is_anonymous) return reply(401, { error: 'Please sign in.' })
    const enrollmentId = new URL(req.url, 'http://localhost').searchParams.get('enrollment')
    const started = Date.now()
    let remaining = 900
    if (enrollmentId !== null) {
      if (!uuid.test(enrollmentId)) return reply(403, { error: 'Unavailable' })
      const enrollment = await db.from('enrollments').select('id').eq('id', enrollmentId).eq('learner_id', user.data.user.id).eq('course_id', courseId).eq('status', 'active').maybeSingle()
      if (enrollment.error) throw enrollment.error
      if (!enrollment.data) return reply(403, { error: 'Unavailable' })
      // The checker MUST call the existing RPC with this user's JWT, not service-role auth.
      const state = await accessCheck(token, enrollmentId, lessonId)
      if (state?.access_status !== 'active' || !Number.isFinite(state.remaining_seconds) || state.remaining_seconds <= 1) return reply(403, { error: 'Unavailable' })
      remaining = state.remaining_seconds
    } else if (!reviewerCheck || await reviewerCheck(token) !== true) return reply(403, { error: 'Unavailable' })
    const lesson = await db.from('lessons').select('page_id').eq('id', lessonId).eq('course_id', courseId).eq('status', 'published').maybeSingle()
    if (lesson.error) throw lesson.error
    if (!lesson.data) return reply(403, { error: 'Unavailable' })
    return reply(200, await signPhaseTwoMedia(db, lesson.data.page_id, remaining, started))
  } catch { return reply(503, { error: 'The academy could not load this material. Please try again.' }) }
}
