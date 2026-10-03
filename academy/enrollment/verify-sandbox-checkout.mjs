import assert, { AssertionError } from 'node:assert/strict'
import { Writable } from 'node:stream'
import Stripe from 'stripe'
import handler from '../../api/site.mjs'

{
  const key = process.env.STRIPE_SECRET_KEY || ''
  const host = process.env.VERCEL_URL || ''
  let stripe
  let sessionId
  try {
    assert.equal(process.env.VERCEL_ENV, 'preview', 'Sandbox verification must run in a Preview build')
    assert.match(key, /^(?:sk|rk)_test_/, 'Preview checkout must use a Stripe test key')
    assert.match(host, /^[a-z0-9-]+\.vercel\.app$/, 'Preview deployment hostname must be configured')
    assert.equal(process.env.ACA_PHASE_ONE_PRICE_ID, 'price_1UJPLZISbjgQbMXEczom8HVV', 'Preview must use the approved sandbox price')
    stripe = new Stripe(key)
    const price = await stripe.prices.retrieve(process.env.ACA_PHASE_ONE_PRICE_ID)
    assert.equal(price.livemode, false, 'The sandbox price must be in test mode')
    assert.equal(price.active, true, 'The sandbox price must be active')
    assert.equal(price.currency, 'usd', 'The sandbox price must be in USD')
    assert.equal(price.unit_amount, 14900, 'The sandbox price must be $149')
    assert.equal(price.type, 'one_time', 'This check is for the one-time $149 checkout')

    // Confirm the user-submitted checkout from this test window without logging customer data.
    const completed = await stripe.checkout.sessions.list({
      status: 'complete',
      created: {
        gte: Math.floor(Date.parse('2026-10-03T03:00:00Z') / 1000),
        lte: Math.floor(Date.parse('2026-10-03T03:13:20Z') / 1000),
      },
      limit: 100,
    })
    assert.equal(completed.has_more, false, 'The completed test checkout search must not be truncated')
    const testedHosts = new Set([
      'aiconfidenceacademy-site-mk-git-c2bdae-teeleebiz-7751s-projects.vercel.app',
      'aiconfidenceacademy-site-mkvf-7zmtngbpr.vercel.app',
    ])
    const matches = completed.data.filter(candidate => {
      let returned
      try { returned = new URL(candidate.success_url) } catch { return false }
      return candidate.metadata?.aca_plan === 'phase_one_paid_in_full'
        && returned.protocol === 'https:'
        && testedHosts.has(returned.hostname)
        && returned.pathname === '/enroll/'
        && returned.search === '?payment=success'
    })
    assert.equal(matches.length, 1, 'Exactly one completed ACA checkout must match the user test window and Preview')
    const paidSession = matches[0]
    assert.match(paidSession.id, /^cs_test_/, 'The completed Checkout Session must be a test session')
    assert.equal(paidSession.livemode, false, 'The completed payment must be in test mode')
    assert.equal(paidSession.mode, 'payment', 'The completed checkout must be a one-time payment')
    assert.equal(paidSession.status, 'complete', 'The user Checkout Session must be complete')
    assert.equal(paidSession.payment_status, 'paid', 'Stripe must confirm that the user test payment is paid')
    assert.equal(paidSession.currency, 'usd', 'The completed test payment must be in USD')
    assert.equal(paidSession.amount_total, 14900, 'The completed test payment must total $149')
    assert.equal(typeof paidSession.payment_intent, 'string', 'The completed test must have a PaymentIntent')
    const [items, payment] = await Promise.all([
      stripe.checkout.sessions.listLineItems(paidSession.id, { limit: 100 }),
      stripe.paymentIntents.retrieve(paidSession.payment_intent),
    ])
    assert.equal(items.has_more, false, 'The test line items must not be truncated')
    assert.equal(items.data.length, 1, 'The completed test checkout must contain one course')
    assert.equal(items.data[0].price?.id, process.env.ACA_PHASE_ONE_PRICE_ID, 'The completed test must use the approved sandbox price')
    assert.equal(items.data[0].quantity, 1, 'The completed test must charge for one course')
    assert.equal(payment.livemode, false, 'The PaymentIntent must be in test mode')
    assert.equal(payment.status, 'succeeded', 'The PaymentIntent must have succeeded')
    assert.equal(payment.currency, 'usd', 'The PaymentIntent currency must be USD')
    assert.equal(payment.amount, 14900, 'The PaymentIntent amount must be $149')
    assert.equal(payment.amount_received, 14900, 'Stripe must record the full $149 test payment')
    console.log('[ACA sandbox payment verification] Passed: user Checkout complete, paid, approved $149 test price, PaymentIntent succeeded, and correct Preview return URL')

    class CaptureResponse extends Writable {
      headers = new Map()
      statusCode = 200
      chunks = []
      setHeader(name, value) { this.headers.set(name.toLowerCase(), value) }
      writeHead(status, headers = {}) {
        this.statusCode = status
        for (const [name, value] of Object.entries(headers)) this.setHeader(name, value)
        return this
      }
      _write(chunk, encoding, callback) { this.chunks.push(Buffer.from(chunk)); callback() }
    }
    const request = async (url, method, headers = {}) => {
      const response = new CaptureResponse()
      await handler({ url, method, headers: { host, ...headers } }, response)
      return response
    }
    const authorization = 'Basic ' + Buffer.from('academy:' + process.env.ACA_CONSTRUCTION_PASSWORD).toString('base64')
    const page = await request('/enroll/', 'GET', { authorization })
    assert.equal(page.statusCode, 200, 'The built enrollment page must load')
    assert.equal(page.headers.get('referrer-policy'), 'same-origin', 'The preview enrollment form must preserve its origin')

    const checkout = await request('/api/enrollment/phase-one/paid-in-full', 'POST', { origin: 'https://' + host })
    assert.equal(checkout.statusCode, 303, 'The deployed handler must redirect to Stripe Checkout')
    const location = new URL(checkout.headers.get('location'))
    assert.equal(location.protocol, 'https:', 'Stripe Checkout must use HTTPS')
    assert.equal(location.hostname, 'checkout.stripe.com', 'Checkout must redirect to Stripe')
    sessionId = location.pathname.match(/cs_test_[A-Za-z0-9]+/)?.[0]
    assert.ok(sessionId, 'Checkout must create a test session')

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    assert.equal(session.livemode, false, 'The Checkout Session must be in test mode')
    assert.equal(session.mode, 'payment', 'The Checkout Session must be a one-time payment')
    assert.equal(session.currency, 'usd', 'The Checkout Session must be in USD')
    assert.equal(session.amount_total, 14900, 'The Checkout Session total must be $149')
    assert.equal(session.payment_status, 'unpaid', 'Verification must not submit a payment')
    assert.equal(session.success_url, 'https://' + host + '/enroll/?payment=success', 'Success must return to the same Preview')
    assert.equal(session.cancel_url, 'https://' + host + '/enroll/?payment=canceled', 'Cancel must return to the same Preview')
    console.log('[ACA sandbox verification] Passed: enrollment page, origin policy, Stripe test price, $149 Checkout Session, and Preview return URLs')
  } catch (error) {
    const detail = error instanceof AssertionError ? error.message : String(error.code || error.type || error.name || 'Unknown error')
    console.error('[ACA sandbox verification] Failed:', detail.replace(/(?:sk|rk)_(?:test|live)_[A-Za-z0-9_]+/g, '[REDACTED_KEY]'))
    process.exitCode = 1
  } finally {
    if (stripe && sessionId) {
      try { await stripe.checkout.sessions.expire(sessionId) }
      catch { console.error('[ACA sandbox verification] Could not expire the verification-only test session'); process.exitCode = 1 }
    }
  }
}
