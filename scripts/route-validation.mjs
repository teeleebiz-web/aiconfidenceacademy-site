import Stripe from 'stripe'

const env = process.env
if (env.VERCEL_ENV !== 'production' || env.VERCEL_PROJECT_ID !== 'prj_bMtMImZai47HLEM7DqlhwOZI81NN') {
  console.log('[ACA route validation] skipped outside target production project')
} else {
  try {
    const origin = new URL(env.ACA_APP_URL).origin
    const base = 'https://checkout.aiconfidenceacademy.org'
    for (const [label, path] of [
      ['paid-in-full', '/api/enrollment/phase-one/paid-in-full'],
      ['installments', '/api/enrollment/phase-one/installments'],
    ]) {
      const response = await fetch(base + path, {
        method: 'POST', headers: { Origin: origin }, redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      })
      const location = response.headers.get('location')
      const checkoutHost = location ? new URL(location).host : null
      console.log('[ACA route validation] checkout', { label, status: response.status, checkoutHost })
      if (response.status !== 303 || checkoutHost !== 'checkout.stripe.com') {
        throw new Error(label + ' route did not redirect to Stripe Checkout')
      }
    }
    const webhookResponse = await fetch(base + '/api/webhooks/stripe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(15000),
    })
    console.log('[ACA route validation] unsigned webhook', { status: webhookResponse.status })
    if (webhookResponse.status !== 400) throw new Error('Webhook was not configured to reject unsigned events')
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
    const target = endpoints.data.filter(x => x.url === base + '/api/webhooks/stripe')
    console.log('[ACA route validation] Stripe webhook configuration', target.map(x => ({
      status: x.status, events: x.enabled_events.filter(e =>
        ['checkout.session.completed', 'invoice.payment_succeeded', 'invoice.payment_failed'].includes(e)),
    })))
    if (target.length !== 1 || target[0].status !== 'enabled' ||
        !['checkout.session.completed', 'invoice.payment_succeeded', 'invoice.payment_failed']
          .every(e => target[0].enabled_events.includes(e) || target[0].enabled_events.includes('*'))) {
      throw new Error('Stripe webhook endpoint or required event subscription is missing')
    }
  } catch (error) {
    console.error('[ACA route validation] failed', {
      type: error.type || error.name, code: error.code, statusCode: error.statusCode,
      message: typeof error.message === 'string'
        ? error.message.replaceAll(env.STRIPE_SECRET_KEY || '', '[redacted]').slice(0, 240)
        : undefined,
    })
    process.exitCode = 1
  }
}
