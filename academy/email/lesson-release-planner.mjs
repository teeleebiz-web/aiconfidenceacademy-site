const time = value => value ? Date.parse(value) : NaN

export function lessonReleaseEventKey(enrollmentId, lessonId) {
  return `lesson-release:${enrollmentId}:${lessonId}`
}

export function planLessonReleaseNotifications({
  enrollments,
  lessons,
  accessStates = [],
  existingEventKeys = [],
  windowStart,
  now,
}) {
  const start = time(windowStart)
  const end = time(now)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error('Lesson release planning requires a valid time window')
  }

  const recorded = new Set(existingEventKeys)
  const stateByEnrollment = new Map(accessStates.map(state => [state.enrollment_id, state]))
  const candidates = []

  for (const enrollment of enrollments || []) {
    if (enrollment.status !== 'active') continue
    const enrollmentStart = time(enrollment.starts_at || enrollment.enrolled_at)
    if (!Number.isFinite(enrollmentStart) || enrollmentStart > end) continue
    if (enrollment.access_expires_at && time(enrollment.access_expires_at) <= end) continue
    const state = stateByEnrollment.get(enrollment.id)
    if (!state || !['available', 'active'].includes(state.access_status)) continue
    const releaseAt = time(state.available_at)
    if (!Number.isFinite(releaseAt) || releaseAt < start || releaseAt >= end) continue
    const lesson = (lessons || []).find(item =>
      item.id === state.current_lesson_id
      && item.course_id === enrollment.course_id
      && item.status === 'published'
    )
    if (!lesson) continue

    const eventKey = lessonReleaseEventKey(enrollment.id, lesson.id)
    if (recorded.has(eventKey)) continue
    candidates.push({
      eventKey,
      enrollmentId: enrollment.id,
      learnerId: enrollment.learner_id,
      courseId: enrollment.course_id,
      lessonId: lesson.id,
      pageId: lesson.page_id,
      lessonTitle: lesson.title,
      releaseAt: new Date(releaseAt).toISOString(),
    })
  }

  return candidates.sort((a, b) => a.releaseAt.localeCompare(b.releaseAt) || a.pageId.localeCompare(b.pageId))
}

export async function loadLessonReleaseCandidates(config, { windowStart, now }) {
  if (!config?.db) throw new Error('Lesson release planning requires the Academy database')

  const { data: enrollments, error: enrollmentError } = await config.db.from('enrollments')
    .select('id,learner_id,course_id,status,starts_at,enrolled_at,access_expires_at').eq('status', 'active')
  if (enrollmentError) throw enrollmentError
  if (!enrollments?.length) return []

  const courseIds = [...new Set(enrollments.map(item => item.course_id))]
  const [{ data: lessons, error: lessonError }, { data: events, error: eventError }, ...accessResults] = await Promise.all([
    config.db.from('lessons')
      .select('id,course_id,page_id,title,unlock_offset_days,status').in('course_id', courseIds).eq('status', 'published'),
    config.db.from('aca_email_events').select('event_key').eq('template_key', 'lesson_release'),
    ...enrollments.map(enrollment => config.db.rpc('get_enrollment_lesson_access', {
      p_enrollment_id: enrollment.id,
      p_at: now,
    })),
  ])
  if (lessonError) throw lessonError
  if (eventError) throw eventError
  const accessError = accessResults.find(result => result.error)?.error
  if (accessError) throw accessError

  return planLessonReleaseNotifications({
    enrollments,
    lessons,
    accessStates: accessResults.flatMap((result, index) =>
      (result.data || []).map(state => ({ ...state, enrollment_id: enrollments[index].id })),
    ),
    existingEventKeys: (events || []).map(item => item.event_key),
    windowStart,
    now,
  })
}
