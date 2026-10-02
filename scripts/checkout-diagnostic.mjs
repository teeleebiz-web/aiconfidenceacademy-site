import Stripe from 'stripe'

const env = process.env
const checkoutProject = env.VERCEL_PROJECT_ID === 'prj_bMtMImZai47HLEM7DqlhwOZI81NN'
if (env.VERCEL_ENV !== 'production' || !checkoutProject) {
  console.log('[ACA checkout diagnostic] skipped', { production: env.VERCEL_ENV === 'production', checkoutProject })
} else if (!env.STRIPE_SECRET_KEY || !env.ACA_PHASE_ONE_PRICE_ID || !env.ACA_APP_URL) {
  console.error('[ACA checkout diagnostic] missing configuration', {
    key: Boolean(env.STRIPE_SECRET_KEY),
    price: Boolean(env.ACA_PHASE_ONE_PRICE_ID),
    appUrl: Boolean(env.ACA_APP_URL),
  })
  process.exitCode = 1
} else {
  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    const appUrl = env.ACA_APP_URL.replace(/\\/$/, '')
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: env.ACA_PHASE_ONE_PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/enroll/?payment=success`,
      cancel_url: `${appUrl}/enroll/?payment=canceled`,
      billing_address_collection: 'auto',
      metadata: { aca_plan: 'phase_one_paid_in_full', aca_course_id: env.ACA_PHASE_ONE_COURSE_ID },
    })
    console.log('[ACA checkout diagnostic] created', {
      livemode: session.livemode, mode: session.mode,
      paymentStatus: session.payment_status, amountTotal: session.amount_total,
      currency: session.currency, checkoutHost: new URL(session.url).host,
    })
  } catch (error) {
    console.error('[ACA checkout diagnostic] failed', {
      type: error.type || error.name, code: error.code, param: error.param,
      statusCode: error.statusCode, requestId: error.requestId,
      message: typeof error.message === 'string'
        ? error.message.replace(/\\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+\\b|\\bwhsec_[A-Za-z0-9]+\\b/g, '[redacted]').slice(0, 500)
        : undefined,
    })
    process.exitCode = 1
  }
}
