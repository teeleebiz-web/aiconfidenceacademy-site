import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { handleStripeEnrollment } from './stripe-webhook.mjs'
import { handleInstallmentMaintenance } from './installment-maintenance.mjs'

test('failed invoice can be paid after access pauses without moving the remaining installment', async () => {
  const plan = { id: 'plan', status: 'active', stripe_subscription_id: 'sub', stripe_first_invoice_id: 'first', enrollment_id: 'enrollment', learner_id: 'learner', customer_email: 'learner@example.com', payments_completed: 1, paid_amount: 5000, next_amount: 5000, next_due_at: '2026-10-10T19:00:00Z', third_due_at: '2026-10-17T19:00:00Z', grace_until: null }
  const tables = { aca_installment_plans: [plan], enrollments: [{ id: 'enrollment', status: 'active' }], aca_payment_events: [], aca_email_events: [] }
  const touched = new Set()
  const db = { from(table) {
    touched.add(table)
    const filters = []; let update; let recorded
    const rows = () => tables[table].filter(row => filters.every(filter => filter(row)))
    return {
      select() { return this }, eq(key, value) { filters.push(row => row[key] === value); return this },
      gte(key, value) { filters.push(row => new Date(row[key]) >= new Date(value)); return this },
      lt(key, value) { filters.push(row => new Date(row[key]) < new Date(value)); return this },
      is(key, value) { filters.push(row => row[key] === value); return this },
      update(value) { update = value; return this },
      upsert(value) {
        const key = table === 'aca_email_events' ? 'event_key' : 'stripe_event_id'
        recorded = tables[table].find(row => row[key] === value[key])
        if (!recorded) { recorded = { id: `${table}-${tables[table].length}`, attempts: 0 }; tables[table].push(recorded) }
        Object.assign(recorded, value); return this
      },
      async maybeSingle() { return { data: rows()[0] ? { ...rows()[0] } : null, error: null } },
      async single() { return { data: recorded, error: null } },
      then(resolve, reject) { const selected = rows(); if (update) selected.forEach(row => Object.assign(row, update)); return Promise.resolve({ data: selected, error: null }).then(resolve, reject) },
    }
  } }
  let event; const sent = []
  const config = { db, cronSecret: 'cron', webhookSecret: 'secret', phaseOnePriceId: 'price', courseId: 'course', appUrl: 'https://example.com', emailFrom: 'ACA <test@example.com>', stripe: { webhooks: { constructEvent: () => event }, invoices: { retrieve: async () => ({ status: 'open', hosted_invoice_url: 'https://invoice.stripe.com/i/test' }) } }, resend: { emails: { send: async message => { sent.push(message); return { data: { id: 'mail' } } } } } }
  const deliver = async (id, type) => {
    event = { id, type, data: { object: { id: 'overdue', amount_due: 5000, amount_paid: 5000, currency: 'usd', parent: { subscription_details: { subscription: 'sub' } } } } }
    const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { 'stripe-signature': 'valid' } })
    const res = { writeHead(status) { this.status = status }, end(body) { this.body = JSON.parse(body) } }
    const work = handleStripeEnrollment(req, res, config); req.emit('end'); await work
    assert.equal(res.status, 200)
    return res.body
  }
  await deliver('failed', 'invoice.payment_failed')
  const deadline = plan.grace_until
  assert.equal(plan.status, 'grace'); assert.equal(tables.enrollments[0].status, 'active')
  assert.match(sent[0].html, /https:\/\/invoice.stripe.com\/i\/test/)
  await deliver('failed', 'invoice.payment_failed')
  await deliver('retry-failed', 'invoice.payment_failed')
  assert.equal(plan.grace_until, deadline); assert.equal(sent.length, 1)
  const res = { writeHead(status) { this.status = status }, end() {} }
  await handleInstallmentMaintenance({ method: 'GET', headers: { authorization: 'Bearer cron' } }, res, config, new Date(new Date(deadline).getTime() + 1))
  assert.equal(plan.status, 'paused'); assert.equal(tables.enrollments[0].status, 'paused')
  await deliver('paused-retry', 'invoice.payment_failed')
  assert.equal(plan.status, 'paused'); assert.equal(plan.grace_until, deadline)
  await deliver('paid', 'invoice.payment_succeeded')
  assert.equal(plan.status, 'active'); assert.equal(tables.enrollments[0].status, 'active')
  assert.equal(plan.payments_completed, 2); assert.equal(plan.paid_amount, 10000)
  assert.equal(plan.next_due_at, '2026-10-17T19:00:00Z'); assert.equal(plan.next_amount, 4900)
  assert.match(sent[1].html, /\$49\.00/); assert.match(sent[1].html, /October 17, 2026/)
  await deliver('paid', 'invoice.payment_succeeded')
  assert.equal(plan.paid_amount, 10000); assert.equal(sent.length, 2)
  assert.deepEqual([...touched].sort(), Object.keys(tables).sort())
})
