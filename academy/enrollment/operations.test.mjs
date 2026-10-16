import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { handleEnrollmentOperations } from './operations.mjs'
import { createAcademyServer } from '../server.mjs'

function fixture({ owner = true, invalid = false, ownerFailure = false, queryFailure = false } = {}) {
  const reads = []
  const tables = {
    enrollments: [{ id: 'enrollment', learner_id: 'learner', status: 'paused', enrolled_at: '2026-10-04T00:00:00Z', starts_at: null, access_expires_at: null }],
    profiles: [{ id: 'learner', display_name: 'Test Learner', account_status: 'active' }],
    aca_installment_plans: [{ enrollment_id: 'enrollment', status: 'paused', total_amount: 14900, paid_amount: 5000, payments_completed: 1, next_amount: 5000 }],
    aca_email_events: [{ enrollment_id: 'enrollment', subject: 'Invitation', status: 'delivered', created_at: '2026-10-04T00:00:00Z', last_error: 'whsec_credentialmustnotleak' }],
    aca_payment_events: [
      { customer_email: 'learner@example.com', stripe_session_id: 'in_failed', amount_total: 5000, currency: 'usd' },
      { customer_email: 'learner@example.com', stripe_session_id: 'cs_test_checkout', amount_total: 5000, currency: 'usd' },
    ],
  }
  const db = {
    auth: { getUser: async token => ({ data: { user: invalid ? null : { id: 'owner', user_metadata: { is_owner: true } } }, error: invalid ? new Error('Invalid') : null }),
      admin: { getUserById: async id => ({ data: { user: { id, email: 'learner@example.com', invited_at: '2026-10-04T00:00:00Z', recovery_token: 'never-return-this' } } }) } },
    from(table) {
      reads.push(table)
      const query = { select() { return this }, eq() { return this }, in() { return this }, order() { return this }, limit() { return this },
        then(resolve) { return Promise.resolve({ data: tables[table], error: queryFailure ? new Error('private database detail') : null }).then(resolve) } }
      return query
    },
  }
  return { db, courseId: 'course', reviewerCheck: async () => { if (ownerFailure) throw new Error('Private authorization detail'); return owner }, reads, tables }
}
async function run(config, { method = 'GET', token = 'session' } = {}) {
  const response = { writeHead(status, headers) { this.status = status; this.headers = headers }, end(body) { this.body = JSON.parse(body) } }
  await handleEnrollmentOperations({ method, headers: token ? { 'x-aca-access-token': token } : {} }, response, config)
  return response
}
test('missing or invalid sessions cannot query enrollment data', async () => {
  for (const [config, token] of [[fixture(), null], [fixture({ invalid: true }), 'bad']]) {
    assert.equal((await run(config, { token })).status, 401)
    assert.deepEqual(config.reads, [])
  }
})
test('user-editable owner claims cannot authorize the administration endpoint', async () => {
  const config = fixture({ owner: false })
  assert.equal((await run(config)).status, 403)
  assert.deepEqual(config.reads, [])
})
test('authorization failures close access without exposing provider details', async () => {
  const config = fixture({ ownerFailure: true })
  const response = await run(config)
  assert.equal(response.status, 503)
  assert.doesNotMatch(JSON.stringify(response.body), /Private authorization/)
  assert.deepEqual(config.reads, [])
})
test('owner view distinguishes sandbox records and reads plan totals rather than counting failed notifications as payments', async () => {
  const response = await run(fixture())
  assert.equal(response.status, 200)
  assert.match(response.headers['Cache-Control'], /no-store/)
  const record = response.body.records[0]
  assert.equal(record.paymentMode, 'sandbox')
  assert.equal(record.payment.paid, 5000)
  assert.equal(record.payment.completed, 1)
  assert.equal(record.status, 'paused')
  assert.equal(record.messages[0].status, 'delivered')
  assert.doesNotMatch(JSON.stringify(response.body), /credentialmustnotleak|recovery_token|never-return-this/)
})
test('founder and fixture access without payment is not labeled as live revenue or unpaid debt', async () => {
  const config = fixture()
  config.tables.aca_installment_plans = []; config.tables.aca_payment_events = []
  const record = (await run(config)).body.records[0]
  assert.equal(record.paymentMode, 'unrecorded'); assert.equal(record.payment, null)
})
test('database failures do not return a partial success or private error', async () => {
  const response = await run(fixture({ queryFailure: true }))
  assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(response.body), /private database detail/)
})
test('an enrollment labeled active can still have expired access', async () => {
  const config = fixture()
  Object.assign(config.tables.enrollments[0], { status: 'active', access_expires_at: '2020-01-01T00:00:00Z' })
  const record = (await run(config)).body.records[0]
  assert.equal(record.status, 'active'); assert.equal(record.accessStatus, 'expired')
})
test('administration route rejects writes and cross-origin access while allowing authenticated browser preflight', async () => {
  const config = fixture()
  const server = createAcademyServer({ password: 'test-only-long-construction-password', root: tmpdir(), db: config.db, courseId: config.courseId, workbookReviewerCheck: config.reviewerCheck })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}/api/operations/enrollments`
  try {
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await fetch(url, { method: 'PATCH', headers: { 'x-aca-access-token': 'session' } })).status, 405)
    assert.equal((await fetch(url, { headers: { Origin: 'https://untrusted.example', 'x-aca-access-token': 'session' } })).status, 403)
    const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://aiconfidenceacademy.org' } })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://aiconfidenceacademy.org')
    assert.deepEqual(config.reads, [])
    const owner = await fetch(url, { headers: { Origin: 'https://aiconfidenceacademy.org', 'x-aca-access-token': 'session' } })
    assert.equal(owner.status, 200)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
