import { test } from 'node:test'
import assert from 'node:assert/strict'
import { workbookIdentity } from './api.mjs'

function fixture(access = { data: [{ released_lesson_ids: ['lesson'] }] }) {
  const reads = []
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'learner' } } }) },
    rpc: async () => access,
    from(table) {
      reads.push(table)
      const rows = {
        enrollments: { id: 'enrollment', course: { status: 'published' } },
        course_journeys: { id: 'journey', status: 'published' },
        lessons: [{ id: 'lesson', page_id: '1.1', status: 'published' }],
      }
      const q = { select: () => q, eq: () => q, in: () => q,
        maybeSingle: async () => ({ data: rows[table] }),
        then: resolve => Promise.resolve({ data: rows[table] }).then(resolve) }
      return q
    },
  }
  const req = { headers: { 'x-aca-access-token': 'learner-token' } }
  return { reads, db, req }
}

test('an expired payment deadline denies even Journey One front matter before maintenance changes enrollment status', async () => {
  const { req, db, reads } = fixture({ data: [] })
  await assert.rejects(workbookIdentity(req, db, 'course', false), e => e.status === 403)
  assert.deepEqual(reads, ['enrollments'])
})
test('a missing access result cannot fall back to workbook front matter', async () => {
  const { req, db } = fixture({ data: null })
  await assert.rejects(workbookIdentity(req, db, 'course', false), e => e.status === 403)
})
test('an access-query failure remains unavailable rather than granting workbook access', async () => {
  const { req, db } = fixture({ error: new Error('database unavailable') })
  await assert.rejects(workbookIdentity(req, db, 'course', false), e => e.status === 503)
})
test('restored payment access uses the same learner scope and released workbook pages', async () => {
  let state = { data: [] }
  const { req, db } = fixture()
  db.rpc = async () => state
  await assert.rejects(workbookIdentity(req, db, 'course', false), e => e.status === 403)
  state = { data: [{ released_lesson_ids: ['lesson'] }] }
  const restored = await workbookIdentity(req, db, 'course', false)
  assert.equal(restored.scope, 'learner')
  assert.equal(restored.learnerId, 'learner')
  assert.ok(restored.allowedPages.includes(5))
  assert.ok(!restored.allowedPages.includes(9))
})
test('existing verified owner review remains independent of learner payment access', async () => {
  const { req, db, reads } = fixture({ data: [] })
  const owner = await workbookIdentity(req, db, 'course', false, 'journey-one', async () => true)
  assert.equal(owner.allowedPages.length, 32)
  assert.deepEqual(reads, [])
})
