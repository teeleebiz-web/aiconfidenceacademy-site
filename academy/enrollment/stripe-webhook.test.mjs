import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { handleStripeEnrollment } from './stripe-webhook.mjs'

const request = () => Object.assign(new EventEmitter(), { method: 'POST', headers: { 'stripe-signature': 'valid' } })
const response = () => ({ status: 0, payload: '', writeHead(status) { this.status = status }, end(value = '') { this.payload = value } })

const database = ({ existingEnrollment = null, completedSession = null, inviteError = null, accessEmail = null, existingPlan = null } = {}) => {
  const writes = []
  const authCalls = []
  const chain = (table) => ({
    select() { return this }, eq() { return this }, limit() { return this },
    maybeSingle: async () => ({ data: table === 'enrollments' ? existingEnrollment : table === 'aca_payment_events' ? completedSession : table === 'aca_email_events' ? accessEmail : table === 'aca_installment_plans' ? existingPlan : null, error: null }),
    single: async () => ({ data: { id: 'course', status: table === 'aca_phase_two_cohorts' ? 'active' : 'published', default_access_days: 30 }, error: null }),
    insert(value) { writes.push([table,'insert',value]); return Promise.resolve({error:null}) },
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
    authCalls,
    from: chain,
    auth: { admin: { generateLink: async options => {
      authCalls.push(options)
      if (inviteError && options.type === 'invite') return { data: null, error: inviteError }
      return { data: { user: { id: 'learner' }, properties: { action_link: 'https://secure.example/invite' } }, error: null }
    } } },
  }
}

test('rejects an unsigned enrollment webhook', async () => {
  const req = request(); const res = response(); const db = database()
  const work = handleStripeEnrollment(req, res, { stripe: { webhooks: { constructEvent() { throw new Error('bad') } } }, webhookSecret: 'secret', phaseOnePriceId: 'price', courseId: 'course', resend: {}, emailFrom: 'ACA <learn@example.com>', appUrl: 'https://example.com', db })
  req.emit('end'); await work
  assert.equal(res.status, 400)
  assert.equal(db.writes.length, 0)
})

async function deliverCheckout({ type = 'checkout.session.completed', paymentStatus = 'paid', price = 'price_129', db = database(), sessionValues = {}, configValues = {} } = {}) {
  const req = request(); const res = response(); const sent = []
  const work = handleStripeEnrollment(req, res, {
    db, webhookSecret: 'secret', phaseOnePriceId: 'legacy_price_149', phaseOneFoundingPriceId: 'price_129',
    courseId: 'course', emailFrom: 'ACA <learn@example.com>', appUrl: 'https://example.com',
    resend: { emails: { send: async message => { sent.push(message); return { data: { id: 'mail' } } } } },
    stripe: {
      webhooks: { constructEvent: () => ({ id: 'event', type, data: { object: {
        id: 'checkout', payment_status: paymentStatus, amount_total: 12900, currency: 'usd', customer_details: { email: 'learner@example.com' },
        ...sessionValues,
      } } }) },
      checkout: { sessions: { listLineItems: async () => ({ data: [{ price: { id: price } }] }) } },
    },
    installment50PriceId: 'price_50', installment49PriceId: 'price_49', ...configValues,
  })
  req.emit('end'); await work
  return { res, db, sent }
}

test('a delayed confirmed $129 payment grants access; an unpaid checkout does not', async () => {
  const unpaid = await deliverCheckout({ paymentStatus: 'unpaid' })
  assert.equal(unpaid.res.status, 200)
  assert.equal(unpaid.db.writes.length, 0)
  const paid = await deliverCheckout({ type: 'checkout.session.async_payment_succeeded' })
  assert.equal(paid.res.status, 200)
  assert.equal(JSON.parse(paid.res.payload).enrolled, true)
  assert.equal(paid.sent.length, 1)
})

test('keeps previous $149 checkouts fulfillable during the $129 offer change', async () => {
  const result = await deliverCheckout({ price: 'legacy_price_149' })
  assert.equal(JSON.parse(result.res.payload).enrolled, true)
})

test('does not grant access for an unrelated product', async () => {
  const result = await deliverCheckout({ price: 'unrelated_price' })
  assert.equal(JSON.parse(result.res.payload).ignored, true)
  assert.equal(result.db.writes.length, 0)
})

test('a second event for an already fulfilled checkout sends no new invitation', async () => {
  const result = await deliverCheckout({ db: database({ completedSession: { status: 'completed' } }) })
  assert.equal(JSON.parse(result.res.payload).duplicate, true)
  assert.equal(result.db.authCalls.length, 0)
  assert.equal(result.db.writes.length, 0)
})

test('retry after an access email was sent keeps its original one-time link valid', async () => {
  const result = await deliverCheckout({ db: database({ accessEmail: { status: 'sent', learner_id: 'learner', enrollment_id: 'enrollment' } }) })
  assert.equal(result.res.status, 200)
  assert.equal(result.db.authCalls.length, 0)
  assert.equal(result.sent.length, 0)
})

test('retry of installment enrollment preserves an already recorded payment schedule', async () => {
  const result = await deliverCheckout({
    price: 'price_50', sessionValues: { subscription: 'sub', metadata: { aca_plan: 'phase_one_installments' } },
    db: database({ accessEmail: { status: 'sent', learner_id: 'learner', enrollment_id: 'enrollment' }, existingPlan: {
      stripe_schedule_id: 'schedule', second_due_at: '2026-10-23T00:00:00Z', third_due_at: '2026-10-30T00:00:00Z',
    } }),
  })
  assert.equal(result.res.status, 200)
  assert.equal(JSON.parse(result.res.payload).plan, 'installments')
  assert.equal(result.db.writes.some(([table]) => table === 'aca_installment_plans'), false)
})

test('an existing learner receives a sign-in link without resetting enrollment dates or completion', async () => {
  const existingEnrollment = { id: 'enrollment', status: 'completed', enrolled_at: '2026-09-01T00:00:00Z', starts_at: '2026-09-02T00:00:00Z', access_expires_at: null, completed_at: '2026-10-01T00:00:00Z' }
  const result = await deliverCheckout({ db: database({ existingEnrollment, inviteError: { code: 'email_exists' } }) })
  assert.equal(result.res.status, 200)
  assert.deepEqual(result.db.authCalls.map(call => call.type), ['invite', 'magiclink'])
  const enrollment = result.db.writes.find(([table, action]) => table === 'enrollments' && action === 'upsert')[2]
  for (const key of ['status', 'enrolled_at', 'starts_at', 'access_expires_at', 'completed_at']) assert.equal(enrollment[key], existingEnrollment[key])
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

const phaseTwoValues = {phaseTwoCourseId:'phase-two-course',phaseTwoPaidInFullPriceId:'price_179',installment67PriceId:'price_67',installment66PriceId:'price_66'}
test('a paid Phase Two checkout creates only Phase Two access and cohort membership',async()=>{
 const {res,db,sent}=await deliverCheckout({price:'price_179',configValues:phaseTwoValues,sessionValues:{amount_total:17900,metadata:{aca_plan:'phase_two_paid_in_full',aca_course_id:'phase-two-course',aca_cohort_id:'cohort'}}})
 assert.equal(res.status,200)
 assert.equal(db.writes.find(([t,a])=>t==='enrollments'&&a==='upsert')[2].course_id,'phase-two-course')
 assert.equal(db.writes.find(([t,a])=>t==='aca_phase_two_memberships'&&a==='insert')[2].cohort_id,'course')
 assert.match(db.authCalls[0].options.redirectTo,/learn\/\?course=phase-two/)
 assert.match(sent[0].html,/Phase Two enrollment/)
 assert.equal(db.writes.find(([t,a])=>t==='aca_payment_events'&&a==='upsert')[2].course_id,'phase-two-course')
})
test('wrong-course metadata or wrong amounts cannot grant Phase Two access',async()=>{
 for(const sessionValues of [{amount_total:17900,metadata:{aca_course_id:'phase-one-course'}},{amount_total:12900,metadata:{aca_course_id:'phase-two-course'}}]){
  const {res,db}=await deliverCheckout({price:'price_179',configValues:phaseTwoValues,sessionValues})
  assert.equal(res.status,500);assert.equal(db.authCalls.length,0);assert.equal(db.writes.some(([t])=>t==='enrollments'),false)
 }
})

test('new independent enrollments have no arbitrary default end and Phase Two needs no cohort',async()=>{
 for(const phase of [1,2]){
  const {res,db}=await deliverCheckout(phase===1?{}:{price:'price_179',configValues:phaseTwoValues,sessionValues:{amount_total:17900,metadata:{aca_course_id:'phase-two-course',aca_release_calendar:'independent-2026-10-31'}}});
  assert.equal(res.status,200);const e=db.writes.find(([t,a])=>t==='enrollments'&&a==='upsert')[2];assert.equal(e.access_expires_at,null);assert.ok(e.starts_at);
  if(phase===2)assert.equal(db.writes.find(([t,a])=>t==='aca_phase_two_memberships'&&a==='insert')[2].cohort_id,null)
 }
})
