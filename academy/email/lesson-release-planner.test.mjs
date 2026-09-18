import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonReleaseEventKey, loadLessonReleaseCandidates, planLessonReleaseNotifications } from './lesson-release-planner.mjs'

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

test('loads active enrollments, published lessons, and recorded events from the Academy database', async () => {
  const calls = []
  const rows = {
    enrollments: [enrollment],
    lessons,
    aca_email_events: [{ event_key: lessonReleaseEventKey('enrollment-1', 'lesson-1') }],
  }
  const db = {
    from(table) {
      const query = {
        select(columns) { calls.push([table, 'select', columns]); return this },
        eq(column, value) {
          calls.push([table, 'eq', column, value])
          return Promise.resolve({ data: rows[table], error: null })
        },
        in(column, value) { calls.push([table, 'in', column, value]); return this },
      }
      return query
    },
  }
  const result = await loadLessonReleaseCandidates({ db }, {
    windowStart: '2026-09-01T09:00:00.000Z', now: '2026-09-02T09:00:01.000Z',
  })
  assert.deepEqual(result.map(item => item.lessonId), ['lesson-2'])
  assert.ok(calls.some(call => call[0] === 'enrollments' && call[1] === 'eq' && call[2] === 'status'))
  assert.ok(calls.some(call => call[0] === 'lessons' && call[1] === 'in' && call[2] === 'course_id'))
  assert.ok(calls.some(call => call[0] === 'aca_email_events' && call[1] === 'eq' && call[2] === 'template_key'))
})
