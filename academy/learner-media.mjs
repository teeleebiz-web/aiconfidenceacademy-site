// Lesson recordings use the same authenticated learner access check as lessons.
export async function handleLearnerMedia(req, res, { db, courseId, lessonId }) {
  const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(data)) }
  if (req.method !== 'GET') return reply(405, { error: 'Method not allowed.' })
  try {
    const token = req.headers['x-aca-access-token']
    if (!token) return reply(401, { error: 'Please sign in.' })
    const user = await db.auth.getUser(token)
    if (user.error || !user.data?.user || user.data.user.is_anonymous) return reply(401, { error: 'Please sign in.' })
    const enrollment = await db.from('enrollments').select('id').eq('learner_id', user.data.user.id).eq('course_id', courseId).in('status', ['active', 'completed']).maybeSingle()
    if (enrollment.error) throw enrollment.error
    if (!enrollment.data) return reply(403, { error: 'Unavailable' })
    const started = Date.now()
    const access = await db.rpc('get_enrollment_lesson_access', { p_enrollment_id: enrollment.data.id })
    if (access.error) throw access.error
    const state = access.data?.[0]
    if (state?.current_lesson_id !== lessonId || state.access_status !== 'active' || !(state.remaining_seconds > 0)) return reply(403, { error: 'Unavailable' })
    const lesson = await db.from('lessons').select('content').eq('id', lessonId).eq('course_id', courseId).eq('status', 'published').maybeSingle()
    if (lesson.error || !lesson.data) return reply(403, { error: 'Unavailable' })
    const ttl = Math.min(7200, Math.floor(state.remaining_seconds))
    const sign = async path => {
      if (!path) return null
      const remaining = ttl - Math.max(1, Math.ceil((Date.now() - started) / 1000))
      if (remaining <= 0) throw new Error('Unavailable')
      const result = await db.storage.from('aca-learning-media').createSignedUrl(path, remaining)
      if (result.error) throw result.error
      return result.data.signedUrl
    }
    const [video, audio] = await Promise.all([sign(lesson.data.content.video_path), sign(lesson.data.content.audio_path)])
    reply(200, { video, audio })
  } catch { reply(503, { error: 'The academy could not load this material. Please try again.' }) }
}
