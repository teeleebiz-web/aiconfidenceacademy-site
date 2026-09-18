import { loadLessonReleaseCandidates } from './lesson-release-planner.mjs'
import { sendOperationalEmail } from './operational-email.mjs'

export async function dispatchLessonReleaseNotifications(config, window) {
  if (!config?.db || !config?.db?.auth?.admin) {
    throw new Error('Lesson release dispatch requires the Academy database')
  }
  if (typeof config.lessonReleaseMessage !== 'function') {
    throw new Error('Approved lesson release message is not configured')
  }

  const load = config.loadLessonReleaseCandidates || loadLessonReleaseCandidates
  const send = config.sendOperationalEmail || sendOperationalEmail
  const candidates = await load(config, window)
  const result = { eligible: candidates.length, sent: 0, skipped: 0, failed: 0 }

  for (const candidate of candidates) {
    try {
      const { data, error } = await config.db.auth.admin.getUserById(candidate.learnerId)
      const recipient = data?.user?.email
      if (error || !recipient) {
        result.skipped++
        continue
      }

      const { data: profile } = await config.db.from('profiles')
        .select('first_name').eq('id', candidate.learnerId).maybeSingle()
      const approved = config.lessonReleaseMessage(candidate, {
        appUrl: config.appUrl,
        learnerFirstName: profile?.first_name || null,
      })
      await send(config, {
        eventKey: candidate.eventKey,
        templateKey: 'lesson_release',
        enrollmentId: candidate.enrollmentId,
        learnerId: candidate.learnerId,
        to: recipient,
        subject: approved.subject,
        html: approved.html,
        metadata: {
          course_id: candidate.courseId,
          lesson_id: candidate.lessonId,
          page_id: candidate.pageId,
          release_at: candidate.releaseAt,
        },
      })
      result.sent++
    } catch {
      result.failed++
    }
  }

  return result
}
