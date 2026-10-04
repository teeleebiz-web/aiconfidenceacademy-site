import assert from 'node:assert/strict'
import test from 'node:test'
import { handleInstallmentMaintenance, isInstallmentReminderDue } from './installment-maintenance.mjs'

test('daily run covers every payment hour two local calendar days ahead', () => {
  const now = new Date('2026-10-08T09:00:00Z')
  for (let hour = 0; hour < 24; hour++) {
    const due = new Date(Date.UTC(2026, 9, 10, hour + 7, 14, 42))
    assert.equal(isInstallmentReminderDue(due, now), true, `payment hour ${hour}`)
    assert.equal(isInstallmentReminderDue(due, new Date('2026-10-07T09:00:00Z')), false)
  }
})

test('handles local calendar boundaries and daylight-saving changes', () => {
  for (const [run, due] of [
    ['2026-10-30T09:00:00Z', '2026-11-02T07:59:00Z'],
    ['2026-03-06T09:00:00Z', '2026-03-09T06:59:00Z'],
    ['2026-12-30T09:00:00Z', '2027-01-02T07:59:00Z'],
  ]) assert.equal(isInstallmentReminderDue(due, new Date(run)), true)
})

test('retries missed reminders before payment without selecting past or distant payments', () => {
  const now = new Date('2026-10-09T09:00:00Z')
  assert.equal(isInstallmentReminderDue('2026-10-10T19:14:42Z', now), true)
  assert.equal(isInstallmentReminderDue(now.toISOString(), now), false)
  assert.equal(isInstallmentReminderDue('2026-10-08T19:14:42Z', now), false)
  assert.equal(isInstallmentReminderDue('2026-10-12T07:00:00Z', now), false)
  assert.equal(isInstallmentReminderDue('invalid', now), false)
})

test('maintenance sends an off-hour reminder once and leaves later payments alone', async () => {
  const tables = {
    aca_installment_plans: [
      { id: 'due', status: 'active', next_due_at: '2026-10-10T19:14:42Z', next_amount: 5000, customer_email: 'test@example.com', reminder_sent_for_due_at: null },
      { id: 'later', status: 'active', next_due_at: '2026-10-11T12:00:00Z', next_amount: 4900, customer_email: 'test@example.com', reminder_sent_for_due_at: null },
    ],
    aca_email_events: [],
  }
  const db = { from(table) {
    const filters = []
    let update
    let recorded
    const rows = () => tables[table].filter(row => filters.every(filter => filter(row)))
    return {
      select() { return this },
      eq(key, value) { filters.push(row => row[key] === value); return this },
      gte(key, value) { filters.push(row => new Date(row[key]) >= new Date(value)); return this },
      lt(key, value) { filters.push(row => new Date(row[key]) < new Date(value)); return this },
      is(key, value) { filters.push(row => row[key] === value); return this },
      update(value) { update = value; return this },
      upsert(value) {
        recorded = tables[table].find(row => row.event_key === value.event_key)
        if (!recorded) { recorded = { id: 'email', attempts: 0 }; tables[table].push(recorded) }
        Object.assign(recorded, value)
        return this
      },
      async maybeSingle() { return { data: rows()[0] || null, error: null } },
      async single() { return { data: recorded, error: null } },
      then(resolve, reject) {
        const selected = rows()
        if (update) selected.forEach(row => Object.assign(row, update))
        return Promise.resolve({ data: selected, error: null }).then(resolve, reject)
      },
    }
  } }
  const sent = []
  const config = { db, cronSecret: 'test', emailFrom: 'ACA <test@example.com>', resend: {
    emails: { send: async message => { sent.push(message); return { data: { id: 'sent' } } } },
  } }
  const run = async () => {
    const res = { writeHead(status) { this.status = status }, end(body) { this.body = JSON.parse(body) } }
    await handleInstallmentMaintenance({ method: 'GET', headers: { authorization: 'Bearer test' } }, res, config, new Date('2026-10-08T09:00:00Z'))
    assert.equal(res.status, 200)
    return res.body
  }
  assert.equal((await run()).remindersSent, 1)
  assert.equal(sent.length, 1)
  assert.match(sent[0].html, /\$50\.00/)
  assert.equal(tables.aca_installment_plans[1].reminder_sent_for_due_at, null)
  assert.equal((await run()).remindersSent, 0)
  assert.equal(sent.length, 1)
})
