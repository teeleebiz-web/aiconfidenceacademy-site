import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { attachApprovedInstallmentSchedule, handleInstallmentCheckout, handlePaidInFullCheckout } from './installment-plan.mjs'

const response = () => ({ status: 0, headers: {}, writeHead(status, headers = {}) { this.status = status; this.headers = headers }, end() {} })

test('opens only the approved $50 installment checkout', async () => {
  let payload
  const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { origin: 'https://aca.example' } })
  const res = response()
  await handleInstallmentCheckout(req, res, {
    stripe: { checkout: { sessions: { create: async value => { payload = value; return { url: 'https://checkout.stripe.test/session' } } } } },
    installment50PriceId: 'price_50', installment49PriceId: 'price_49', courseId: 'course', appUrl: 'https://aca.example',
  })
  assert.equal(res.status, 303)
  assert.equal(res.headers.Location, 'https://checkout.stripe.test/session')
  assert.equal(payload.mode, 'subscription')
  assert.deepEqual(payload.line_items, [{ price: 'price_50', quantity: 1 }])
  assert.equal(payload.subscription_data.metadata.aca_total_cents, '14900')
})

test('rejects an installment checkout from another origin', async () => {
  const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { origin: 'https://wrong.example' } })
  const res = response()
  await handleInstallmentCheckout(req, res, {
    stripe: {}, installment50PriceId: 'price_50', installment49PriceId: 'price_49', appUrl: 'https://aca.example',
  })
  assert.equal(res.status, 403)
})

test('opens the approved $129 pay-in-full checkout separately', async () => {
  let payload
  const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { origin: 'https://aca.example' } })
  const res = response()
  await handlePaidInFullCheckout(req, res, {
    stripe: { checkout: { sessions: { create: async value => { payload = value; return { url: 'https://checkout.stripe.test/full' } } } } },
    phaseOnePriceId: 'price_129', courseId: 'course', appUrl: 'https://aca.example',
  })
  assert.equal(res.status, 303)
  assert.equal(payload.mode, 'payment')
  assert.deepEqual(payload.line_items, [{ price: 'price_129', quantity: 1 }])
})

test('sets exactly three weekly phases and cancels after $50, $50, $49', async () => {
  let update
  const stripe = { subscriptionSchedules: {
    create: async () => ({ id: 'schedule', current_phase: { start: 1000, end: 605800 } }),
    update: async (id, value) => { update = value; return { id } },
  } }
  const result = await attachApprovedInstallmentSchedule(stripe, 'subscription', { installment50PriceId: 'price_50', installment49PriceId: 'price_49' })
  assert.equal(update.end_behavior, 'cancel')
  assert.equal(update.phases.length, 3)
  assert.equal(update.phases[0].items[0].price, 'price_50')
  assert.equal(update.phases[1].items[0].price, 'price_50')
  assert.equal(update.phases[2].items[0].price, 'price_49')
  assert.deepEqual(update.phases.slice(1).map(phase => phase.duration), [
    { interval: 'week', interval_count: 1 }, { interval: 'week', interval_count: 1 },
  ])
  assert.equal(result.thirdDueAt.getTime() - result.secondDueAt.getTime(), 7 * 86400000)
})
