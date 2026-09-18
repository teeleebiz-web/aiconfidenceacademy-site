const time = value => value ? Date.parse(value) : NaN

export function lessonReleaseEventKey(enrollmentId, lessonId) {
  return `lesson-release:${enrollmentId}:${lessonId}`
}

export function planLessonReleaseNotifications({
  enrollments,
  lessons,
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
  const candidates = []

  for (const enrollment of enrollments || []) {
    if (enrollment.status !== 'active') continue
    const enrollmentStart = time(enrollment.starts_at || enrollment.enrolled_at)
    if (!Number.isFinite(enrollmentStart) || enrollmentStart > end) continue
    if (enrollment.access_expires_at && time(enrollment.access_expires_at) <= end) continue

    for (const lesson of lessons || []) {
      if (lesson.course_id !== enrollment.course_id || lesson.status !== 'published') continue
      const offsetDays = Number(lesson.unlock_offset_days)
      if (!Number.isFinite(offsetDays) || offsetDays < 0) continue

      const releaseAt = enrollmentStart + offsetDays * 86400000
      if (releaseAt < start || releaseAt >= end) continue

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
  }

  return candidates.sort((a, b) => a.releaseAt.localeCompare(b.releaseAt) || a.pageId.localeCompare(b.pageId))
}
