import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
const acceptedRequest = () => Object.assign(Readable.from(['termsAccepted=yes&policyVersion=2026-10-17']), {method:'POST',headers:{origin:'https://aca.example'}})
import { attachApprovedInstallmentSchedule, handleInstallmentCheckout, handlePaidInFullCheckout } from './installment-plan.mjs'

const response = () => ({ status: 0, headers: {}, writeHead(status, headers = {}) { this.status = status; this.headers = headers }, end() {} })

test('opens only the approved $50 installment checkout', async () => {
  let payload
  const req = acceptedRequest()
  const res = response()
  await handleInstallmentCheckout(req, res, {
    stripe: { checkout: { sessions: { create: async value => { payload = value; return { url: 'https://checkout.stripe.test/session' } } } } },
    installment50PriceId: 'price_50', installment49PriceId: 'price_49', courseId: 'course', appUrl: 'https://aca.example',
  })
  assert.equal(res.status, 303)
  assert.equal(res.headers.Location, 'https://checkout.stripe.test/session')
  assert.equal(payload.metadata.aca_policy_version, '2026-10-17')
  assert.ok(payload.metadata.aca_terms_accepted_at)
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
  const req = acceptedRequest()
  const res = response()
  await handlePaidInFullCheckout(req, res, {
    phaseOneFoundingPriceId: 'price_129',
    stripe: { prices: { retrieve: async () => ({ active: true, currency: 'usd', unit_amount: 12900, type: 'one_time' }) }, checkout: { sessions: { create: async value => { payload = value; return { url: 'https://checkout.stripe.test/full' } } } } },
    phaseOnePriceId: 'price_149_legacy', courseId: 'course', appUrl: 'https://aca.example',
  })
  assert.equal(res.status, 303)
  assert.equal(payload.mode, 'payment')
  assert.deepEqual(payload.line_items, [{ price: 'price_129', quantity: 1 }])
  assert.equal(payload.metadata.aca_total_cents, '12900')
})

test('never sends a learner to a mismatched founding price', async () => {
  for (const price of [
    { active: true, currency: 'usd', unit_amount: 14900, type: 'one_time' },
    { active: false, currency: 'usd', unit_amount: 12900, type: 'one_time' },
    { active: true, currency: 'usd', unit_amount: 12900, type: 'recurring' },
    { active: true, currency: 'eur', unit_amount: 12900, type: 'one_time' },
  ]) {
    const req = acceptedRequest()
    const res = response()
    let sessionsCreated = 0
    await handlePaidInFullCheckout(req, res, {
      phaseOneFoundingPriceId: 'wrong_price', appUrl: 'https://aca.example',
      stripe: { prices: { retrieve: async () => price }, checkout: { sessions: { create: async () => { sessionsCreated++ } } } },
    })
    assert.equal(res.status, 502)
    assert.equal(sessionsCreated, 0)
  }
})

test('sets exactly three weekly phases and cancels after $50, $50, $49', async () => {
  let update
  const stripe = { subscriptions: { retrieve: async () => ({ schedule: null }) }, subscriptionSchedules: {
    create: async () => ({ id: 'schedule', current_phase: { start_date: 1000, end_date: 605800 } }),
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

test('retries a partially attached schedule without migrating the subscription again', async () => {
  let updates = 0
  const stripe = {
    subscriptions: { retrieve: async () => ({ schedule: 'existing_schedule' }) },
    subscriptionSchedules: {
      create: async () => { throw new Error('must not migrate twice') },
      retrieve: async id => ({ id, current_phase: { start_date: 1000, end_date: 605800 } }),
      update: async (id, value) => { updates++; assert.equal(value.end_behavior, 'cancel'); return { id } },
    },
  }
  const result = await attachApprovedInstallmentSchedule(stripe, 'subscription', { installment50PriceId: 'price_50', installment49PriceId: 'price_49' })
  assert.equal(result.scheduleId, 'existing_schedule')
  assert.equal(result.secondDueAt.getTime(), 605800000)
  assert.equal(updates, 1)
})

test('missing or obsolete acceptance cannot open either checkout', async () => {
 for (const handler of [handlePaidInFullCheckout,handleInstallmentCheckout]) for(const raw of ['', 'termsAccepted=yes&policyVersion=old']) {
  let calls=0
  const req=Object.assign(Readable.from([raw]),{method:'POST',headers:{origin:'https://aca.example'}}),res=response()
  await handler(req,res,{appUrl:'https://aca.example',phaseOnePriceId:'p',installment50PriceId:'p50',installment49PriceId:'p49',stripe:{checkout:{sessions:{create(){calls++;throw Error('must not charge')}}}}})
  assert.equal(res.status,400);assert.equal(calls,0)
 }
})

test('Vercel parsed form bodies retain acceptance before checkout',async()=>{
 const req={method:'POST',headers:{origin:'https://aca.example'},body:{termsAccepted:'yes',policyVersion:'2026-10-17'},[Symbol.asyncIterator](){throw Error('stream already consumed')}},res=response()
 await handlePaidInFullCheckout(req,res,{appUrl:'https://aca.example',phaseOnePriceId:'p',stripe:{prices:{retrieve:async()=>({active:true,currency:'usd',unit_amount:12900,type:'one_time'})},checkout:{sessions:{create:async()=>({url:'https://checkout.stripe.test/example'})}}}})
 assert.equal(res.status,303)
})
