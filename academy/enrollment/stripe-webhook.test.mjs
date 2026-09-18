import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { handleStripeEnrollment } from './stripe-webhook.mjs'

const request = () => Object.assign(new EventEmitter(), { method: 'POST', headers: { 'stripe-signature': 'valid' } })
const response = () => ({ status: 0, payload: '', writeHead(status) { this.status = status }, end(value = '') { this.payload = value } })

const database = () => {
  const writes = []
  const chain = (table) => ({
    select() { return this }, eq() { return this },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: { id: 'course', status: 'published', default_access_days: 30 }, error: null }),
    upsert(value) {
      writes.push([table, 'upsert', value])
      if (table === 'enrollments') {
        return { select() { return this }, async single() { return { data: { id: 'enrollment' }, error: null } } }
      }
      if (table === 'aca_email_events') {
        return { select() { return this }, async single() { return { data: { id: 'mail-1', attempts: 0 }, error: null } } }
      }
      return Promise.resolve({ error: null })
    },
    update(value) { writes.push([table, 'update', value]); return { eq: async () => ({ error: null }) } },
  })
  return {
    writes,
    from: chain,
    auth: { admin: { generateLink: async () => ({ data: { user: { id: 'learner' }, properties: { action_link: 'https://secure.example/invite' } }, error: null }) } },
  }
}

test('rejects an unsigned enrollment webhook', async () => {
  const req = request(); const res = response(); const db = database()
  const work = handleStripeEnrollment(req, res, { stripe: { webhooks: { constructEvent() { throw new Error('bad') } } }, webhookSecret: 'secret', phaseOnePriceId: 'price', courseId: 'course', resend: {}, emailFrom: 'ACA <learn@example.com>', appUrl: 'https://example.com', db })
  req.emit('end'); await work
  assert.equal(res.status, 400)
  assert.equal(db.writes.length, 0)
})

test('activates one paid Phase One enrollment and sends its secure entrance', async () => {
  const req = request(); const res = response(); const db = database(); const sent = []
  const stripe = {
    webhooks: { constructEvent: () => ({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: 10000, currency: 'usd', customer_details: { email: 'Learner@example.com', name: 'Alex Learner' } } } }) },
    checkout: { sessions: { listLineItems: async () => ({ data: [{ price: { id: 'price_phase_one' } }] }) } },
  }
  const work = handleStripeEnrollment(req, res, {
    stripe,
    webhookSecret: 'secret',
    phaseOnePriceId: 'price_phase_one',
    courseId: 'course',
    resend: { emails: { send: async message => { sent.push(message); return { error: null } } } },
    emailFrom: 'ACA <learn@example.com>',
    appUrl: 'https://example.com',
    db,
  })
  req.emit('data', Buffer.from('{}')); req.emit('end'); await work
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.payload).enrolled, true)
  assert.equal(sent[0].to, 'learner@example.com')
  assert.match(sent[0].html, /secure\.example\/invite/)
  assert.equal(db.writes.some(([table, action, value]) => table === 'enrollments' && action === 'upsert' && value.status === 'active'), true)
})
