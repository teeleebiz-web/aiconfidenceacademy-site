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
    const price = await stripe.prices.retrieve(env.ACA_PHASE_ONE_PRICE_ID, { expand: ['product'] })
    console.log('[ACA checkout diagnostic] product', { amount: price.unit_amount, currency: price.currency, productName: price.product.name, productDescription: price.product.description, taxCode: price.product.tax_code, priceActive: price.active })
    if (price.unit_amount !== 14900 || price.currency !== 'usd' || price.product.name !== 'AI Confidence Academy — Phase One') throw new Error('Unexpected Phase One product; refusing tax-code update')
    if (!price.product.tax_code) {
      const updated = await stripe.products.update(price.product.id, { tax_code: 'txcd_20060158' })
      console.log('[ACA checkout diagnostic] updated course tax code', { taxCode: updated.tax_code, productName: updated.name })
    }
    const appUrl = env.ACA_APP_URL.endsWith('/') ? env.ACA_APP_URL.slice(0, -1) : env.ACA_APP_URL
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

    for (const [label, priceId, expectedAmount] of [
      ['first and second installment', env.ACA_INSTALLMENT_50_PRICE_ID, 5000],
      ['third installment', env.ACA_INSTALLMENT_49_PRICE_ID, 4900],
    ]) {
      if (!priceId) throw new Error('Missing installment price ID: ' + label)
      const installmentPrice = await stripe.prices.retrieve(priceId, { expand: ['product'] })
      console.log('[ACA checkout diagnostic] installment product', { label, amount: installmentPrice.unit_amount, currency: installmentPrice.currency, productName: installmentPrice.product.name, productDescription: installmentPrice.product.description, taxCode: installmentPrice.product.tax_code, priceActive: installmentPrice.active })
      if (installmentPrice.unit_amount !== expectedAmount || installmentPrice.currency !== 'usd' || !installmentPrice.active || !installmentPrice.product.name.includes('Phase One')) throw new Error('Unexpected installment product: ' + label)
      if (!installmentPrice.product.tax_code) {
        const updated = await stripe.products.update(installmentPrice.product.id, { tax_code: 'txcd_20060158' })
        console.log('[ACA checkout diagnostic] updated installment course tax code', { label, taxCode: updated.tax_code, productName: updated.name })
      }
    }
    const installmentSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: env.ACA_INSTALLMENT_50_PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/enroll/?payment=success`,
      cancel_url: `${appUrl}/enroll/?payment=canceled`,
      billing_address_collection: 'auto',
      subscription_data: { metadata: { aca_plan: 'phase_one_installments', aca_course_id: env.ACA_PHASE_ONE_COURSE_ID, aca_total_cents: '14900' } },
      metadata: { aca_plan: 'phase_one_installments', aca_course_id: env.ACA_PHASE_ONE_COURSE_ID },
    })
    console.log('[ACA checkout diagnostic] installment session created', {
      livemode: installmentSession.livemode, mode: installmentSession.mode,
      paymentStatus: installmentSession.payment_status, amountTotal: installmentSession.amount_total,
      currency: installmentSession.currency, checkoutHost: new URL(installmentSession.url).host,
    })
  } catch (error) {
    console.error('[ACA checkout diagnostic] failed', {
      type: error.type || error.name, code: error.code, param: error.param,
      statusCode: error.statusCode, requestId: error.requestId,
      message: typeof error.message === 'string'
        ? error.message.replaceAll(env.STRIPE_SECRET_KEY, '[redacted]').slice(0, 500)
        : undefined,
    })
    process.exitCode = 1
  }
}
