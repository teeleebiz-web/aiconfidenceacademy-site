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
