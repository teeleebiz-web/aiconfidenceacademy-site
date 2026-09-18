import assert from 'node:assert/strict'
import test from 'node:test'
import { dispatchLessonReleaseNotifications } from './lesson-release-dispatch.mjs'

const candidate = {
  eventKey: 'lesson-release:enrollment-1:lesson-2',
  enrollmentId: 'enrollment-1', learnerId: 'learner-1', courseId: 'course-1',
  lessonId: 'lesson-2', pageId: '1.2', lessonTitle: 'Second lesson',
  releaseAt: '2026-09-02T09:00:00.000Z',
}

function config(overrides = {}) {
  const sent = []
  return {
    sent,
    db: { auth: { admin: { getUserById: async () => ({ data: { user: { email: 'learner@example.com' } }, error: null }) } } },
    loadLessonReleaseCandidates: async () => [candidate],
    lessonReleaseMessage: lesson => ({ subject: `Approved ${lesson.pageId}`, html: '<p>Approved message</p>' }),
    sendOperationalEmail: async (_config, message) => { sent.push(message) },
    ...overrides,
  }
}

test('dispatches an approved message with stable lesson and enrollment identifiers', async () => {
  const options = config()
  const result = await dispatchLessonReleaseNotifications(options, {
    windowStart: '2026-09-02T08:00:00.000Z', now: '2026-09-02T10:00:00.000Z',
  })
  assert.deepEqual(result, { eligible: 1, sent: 1, skipped: 0, failed: 0 })
  assert.equal(options.sent[0].eventKey, candidate.eventKey)
  assert.equal(options.sent[0].templateKey, 'lesson_release')
  assert.equal(options.sent[0].to, 'learner@example.com')
  assert.equal(options.sent[0].metadata.lesson_id, 'lesson-2')
})

test('refuses to dispatch before learner-facing wording is approved and configured', async () => {
  const options = config({ lessonReleaseMessage: null })
  await assert.rejects(
    () => dispatchLessonReleaseNotifications(options, { windowStart: 'start', now: 'end' }),
    /Approved lesson release message is not configured/,
  )
  assert.equal(options.sent.length, 0)
})

test('skips a learner record without a deliverable email address', async () => {
  const options = config({
    db: { auth: { admin: { getUserById: async () => ({ data: { user: {} }, error: null }) } } },
  })
  const result = await dispatchLessonReleaseNotifications(options, {
    windowStart: '2026-09-02T08:00:00.000Z', now: '2026-09-02T10:00:00.000Z',
  })
  assert.deepEqual(result, { eligible: 1, sent: 0, skipped: 1, failed: 0 })
  assert.equal(options.sent.length, 0)
})

test('isolates a provider failure so one message does not stop the remaining batch', async () => {
  const second = { ...candidate, eventKey: 'lesson-release:enrollment-2:lesson-2', enrollmentId: 'enrollment-2', learnerId: 'learner-2' }
  let attempts = 0
  const options = config({
    loadLessonReleaseCandidates: async () => [candidate, second],
    sendOperationalEmail: async () => { attempts++; if (attempts === 1) throw new Error('provider failure') },
  })
  const result = await dispatchLessonReleaseNotifications(options, {
    windowStart: '2026-09-02T08:00:00.000Z', now: '2026-09-02T10:00:00.000Z',
  })
  assert.deepEqual(result, { eligible: 2, sent: 1, skipped: 0, failed: 1 })
  assert.equal(attempts, 2)
})
