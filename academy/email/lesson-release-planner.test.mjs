import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonReleaseEventKey, planLessonReleaseNotifications } from './lesson-release-planner.mjs'

const enrollment = {
  id: 'enrollment-1', learner_id: 'learner-1', course_id: 'course-1', status: 'active',
  starts_at: '2026-09-01T09:00:00.000Z', enrolled_at: '2026-09-01T09:00:00.000Z', access_expires_at: null,
}
const lessons = [
  { id: 'lesson-1', course_id: 'course-1', page_id: '1.1', title: 'First lesson', unlock_offset_days: 0, status: 'published' },
  { id: 'lesson-2', course_id: 'course-1', page_id: '1.2', title: 'Second lesson', unlock_offset_days: 1, status: 'published' },
  { id: 'draft', course_id: 'course-1', page_id: '1.3', title: 'Draft lesson', unlock_offset_days: 1, status: 'draft' },
]

test('plans only published lessons released inside the requested window', () => {
  const result = planLessonReleaseNotifications({
    enrollments: [enrollment], lessons, existingEventKeys: [],
    windowStart: '2026-09-01T09:00:00.000Z', now: '2026-09-02T09:00:01.000Z',
  })
  assert.deepEqual(result.map(item => item.lessonId), ['lesson-1', 'lesson-2'])
  assert.equal(result[1].releaseAt, '2026-09-02T09:00:00.000Z')
})

test('does not plan an event that already exists in the operational ledger', () => {
  const result = planLessonReleaseNotifications({
    enrollments: [enrollment], lessons,
    existingEventKeys: [lessonReleaseEventKey('enrollment-1', 'lesson-2')],
    windowStart: '2026-09-02T08:00:00.000Z', now: '2026-09-02T10:00:00.000Z',
  })
  assert.deepEqual(result, [])
})

test('excludes paused, future, and expired enrollments', () => {
  const variants = [
    { ...enrollment, id: 'paused', status: 'paused' },
    { ...enrollment, id: 'future', starts_at: '2026-09-03T09:00:00.000Z' },
    { ...enrollment, id: 'expired', access_expires_at: '2026-09-02T08:59:59.000Z' },
  ]
  const result = planLessonReleaseNotifications({
    enrollments: variants, lessons, existingEventKeys: [],
    windowStart: '2026-09-02T08:00:00.000Z', now: '2026-09-02T10:00:00.000Z',
  })
  assert.deepEqual(result, [])
})

test('rejects an invalid or reversed scheduling window', () => {
  assert.throws(() => planLessonReleaseNotifications({
    enrollments: [], lessons: [], windowStart: '2026-09-02T10:00:00.000Z', now: '2026-09-02T09:00:00.000Z',
  }), /valid time window/)
})
