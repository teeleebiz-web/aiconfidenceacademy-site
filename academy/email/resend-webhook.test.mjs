import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { handleResendWebhook, recordResendEvent } from './resend-webhook.mjs'

function database(existing = { id: 'mail-1', status: 'sent' }) {
  const writes = []
  return {
    writes,
    from() {
      return {
        select() { return this },
        eq() { return this },
        maybeSingle: async () => ({ data: existing, error: null }),
        update(value) { writes.push(value); return { eq: async () => ({ error: null }) } },
      }
    },
  }
}

const event = (type, extra = {}) => ({
  type,
  created_at: '2026-09-18T20:00:00.000Z',
  data: { email_id: 'provider-1', ...extra },
})

test('records a delivered email with the provider timestamp', async () => {
  const db = database()
  const result = await recordResendEvent({ db }, event('email.delivered'))
  assert.equal(result.status, 'delivered')
  assert.deepEqual(db.writes[0], {
    status: 'delivered', delivered_at: '2026-09-18T20:00:00.000Z', last_error: null,
  })
})

test('records provider failure details for operations review', async () => {
  const db = database()
  await recordResendEvent({ db }, event('email.bounced', { bounce: { message: 'Mailbox unavailable' } }))
  assert.deepEqual(db.writes[0], { status: 'bounced', last_error: 'Mailbox unavailable' })
})

test('does not regress delivered email when a late sent event arrives', async () => {
  const db = database({ id: 'mail-1', status: 'delivered' })
  const result = await recordResendEvent({ db }, event('email.sent'))
  assert.equal(result.duplicate, true)
  assert.equal(db.writes.length, 0)
})

test('ignores provider events that are not ACA operational email records', async () => {
  const db = database(null)
  const result = await recordResendEvent({ db }, event('email.delivered'))
  assert.equal(result.ignored, true)
  assert.equal(db.writes.length, 0)
})

test('rejects webhook payloads with an invalid signature', async () => {
  const request = new EventEmitter()
  request.method = 'POST'
  request.headers = { 'svix-id': 'id', 'svix-timestamp': 'time', 'svix-signature': 'bad' }
  const response = {
    status: null, payload: '',
    writeHead(status) { this.status = status },
    end(chunk = '') { this.payload += chunk },
  }
  const config = {
    db: database(), resendWebhookSecret: 'secret',
    resend: { webhooks: { verify() { throw new Error('invalid') } } },
  }
  const promise = handleResendWebhook(request, response, config)
  request.emit('data', Buffer.from('{}'))
  request.emit('end')
  await promise
  assert.equal(response.status, 400)
  assert.deepEqual(JSON.parse(response.payload), { error: 'Invalid webhook signature' })
})
