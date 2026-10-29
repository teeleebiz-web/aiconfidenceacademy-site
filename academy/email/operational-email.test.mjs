import assert from 'node:assert/strict'
import test from 'node:test'
import { sendOperationalEmail } from './operational-email.mjs'

function database(existing = null) {
  const writes = []
  return {
    writes,
    from() {
      return {
        select() { return this },
        eq() { return this },
        maybeSingle: async () => ({ data: existing, error: null }),
        upsert(value) {
          writes.push(['upsert', value])
          return { select() { return this }, async single() { return { data: { id: 'mail-1', attempts: 0 }, error: null } } }
        },
        update(value) { writes.push(['update', value]); return { eq: async () => ({ error: null }) } },
      }
    },
  }
}

const message = {
  eventKey: 'enrollment-access:cs_1', templateKey: 'enrollment_access',
  to: 'Learner@Example.com', subject: 'Your ACA access is ready', html: '<p>Welcome</p>',
}

test('records and sends one operational email with a stable idempotency key', async () => {
  const db = database(); const sends = []
  const result = await sendOperationalEmail({
    db, emailFrom: 'ACA <learn@example.com>',
    resend: { emails: { send: async (...args) => { sends.push(args); return { data: { id: 'provider-1' }, error: null } } } },
  }, message)
  assert.equal(result.providerMessageId, 'provider-1')
  assert.equal(sends[0][0].to, 'learner@example.com')
  assert.equal(sends[0][1].idempotencyKey, message.eventKey)
  assert.equal(db.writes[0][1].status, 'sending')
  assert.equal(db.writes.at(-1)[1].status, 'sent')
})

test('does not resend an event already recorded as sent', async () => {
  const db = database({ id: 'mail-1', status: 'sent' }); let sends = 0
  const result = await sendOperationalEmail({
    db, emailFrom: 'ACA <learn@example.com>',
    resend: { emails: { send: async () => { sends++; return { data: { id: 'unexpected' } } } } },
  }, message)
  assert.equal(result.duplicate, true)
  assert.equal(sends, 0)
  assert.equal(db.writes.length, 0)
})

test('records provider failure without exposing the provider detail to callers', async () => {
  const db = database()
  await assert.rejects(() => sendOperationalEmail({
    db, emailFrom: 'ACA <learn@example.com>',
    resend: { emails: { send: async () => ({ error: { message: 'private provider detail' } }) } },
  }, message), /Academy email could not be sent/)
  assert.equal(db.writes.at(-1)[1].status, 'failed')
  assert.equal(db.writes.at(-1)[1].last_error, 'private provider detail')
})
