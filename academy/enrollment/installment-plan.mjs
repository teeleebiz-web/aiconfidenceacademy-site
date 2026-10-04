const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

const appOrigin = value => {
  try { return new URL(value).origin } catch { return null }
}

const logCheckoutFailure = (mode, error) => {
  const details = error && typeof error === 'object' ? error : {}
  console.error('[ACA checkout] Stripe session creation failed', {
    mode,
    type: details.type || details.name,
    code: details.code,
    param: details.param,
    statusCode: details.statusCode,
    requestId: details.requestId,
    message: typeof details.message === 'string'
      ? details.message.replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+\b|\bwhsec_[A-Za-z0-9]+\b/g, '[redacted]').slice(0, 500)
      : undefined,
  })
}

export async function handleInstallmentCheckout(req, res, config) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!config?.stripe || !config?.installment50PriceId || !config?.installment49PriceId || !config?.appUrl) {
    return json(res, 503, { error: 'Installment enrollment is not configured' })
  }

  const expectedOrigin = appOrigin(config.appUrl)
  const suppliedOrigin = appOrigin(req.headers.origin || req.headers.referer)
  if (!expectedOrigin || suppliedOrigin !== expectedOrigin) {
    return json(res, 403, { error: 'Request origin was not accepted' })
  }

  try {
    const session = await config.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: config.installment50PriceId, quantity: 1 }],
      success_url: `${config.appUrl.replace(/\/$/, '')}/enroll/?payment=success`,
      cancel_url: `${config.appUrl.replace(/\/$/, '')}/enroll/?payment=canceled`,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: {
          aca_plan: 'phase_one_installments',
          aca_course_id: config.courseId,
          aca_total_cents: '14900',
        },
      },
      metadata: {
        aca_plan: 'phase_one_installments',
        aca_course_id: config.courseId,
      },
    })
    res.writeHead(303, { Location: session.url, 'Cache-Control': 'no-store' })
    res.end()
  } catch (error) {
    logCheckoutFailure('installment', error)
    return json(res, 502, { error: 'The secure installment checkout could not be opened' })
  }
}

export async function handlePaidInFullCheckout(req, res, config) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!config?.stripe || !config?.phaseOnePriceId || !config?.appUrl) {
    return json(res, 503, { error: 'Pay-in-full enrollment is not configured' })
  }
  const expectedOrigin = appOrigin(config.appUrl)
  const suppliedOrigin = appOrigin(req.headers.origin || req.headers.referer)
  if (!expectedOrigin || suppliedOrigin !== expectedOrigin) return json(res, 403, { error: 'Request origin was not accepted' })
  try {
    const session = await config.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: config.phaseOnePriceId, quantity: 1 }],
      success_url: `${config.appUrl.replace(/\/$/, '')}/enroll/?payment=success`,
      cancel_url: `${config.appUrl.replace(/\/$/, '')}/enroll/?payment=canceled`,
      billing_address_collection: 'auto',
      metadata: { aca_plan: 'phase_one_paid_in_full', aca_course_id: config.courseId },
    })
    res.writeHead(303, { Location: session.url, 'Cache-Control': 'no-store' })
    res.end()
  } catch (error) {
    logCheckoutFailure('one-time', error)
    return json(res, 502, { error: 'The secure pay-in-full checkout could not be opened' })
  }
}

export async function attachApprovedInstallmentSchedule(stripe, subscriptionId, prices) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const existingId = typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule?.id
  const schedule = existingId
    ? await stripe.subscriptionSchedules.retrieve(existingId)
    : await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId })
  if (!schedule.current_phase?.start_date || !schedule.current_phase?.end_date) {
    throw new Error('Stripe did not return the active installment phase')
  }

  const updated = await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'cancel',
    proration_behavior: 'none',
    phases: [
      {
        items: [{ price: prices.installment50PriceId, quantity: 1 }],
        start_date: schedule.current_phase.start_date,
        end_date: schedule.current_phase.end_date,
        proration_behavior: 'none',
        metadata: { aca_installment_number: '1' },
      },
      {
        items: [{ price: prices.installment50PriceId, quantity: 1 }],
        duration: { interval: 'week', interval_count: 1 },
        proration_behavior: 'none',
        metadata: { aca_installment_number: '2' },
      },
      {
        items: [{ price: prices.installment49PriceId, quantity: 1 }],
        duration: { interval: 'week', interval_count: 1 },
        proration_behavior: 'none',
        metadata: { aca_installment_number: '3' },
      },
    ],
  })

  return {
    scheduleId: updated.id,
    secondDueAt: new Date(schedule.current_phase.end_date * 1000),
    thirdDueAt: new Date((schedule.current_phase.end_date + 7 * 86400) * 1000),
  }
}

export const installmentConfirmationHtml = ({ secondDueAt, thirdDueAt }) => `
  <div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6">
    <h1>Your ACA installment plan is confirmed</h1>
    <p>Your first $50 payment was received.</p>
    <ul>
      <li>$50 on ${secondDueAt.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'America/Los_Angeles' })}</li>
      <li>$49 on ${thirdDueAt.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'America/Los_Angeles' })}</li>
    </ul>
    <p>We will send a reminder two days before each scheduled payment. After the third successful payment, this payment schedule ends automatically.</p>
  </div>`

export const upcomingInstallmentHtml = ({ amount, dueAt }) => `
  <div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6">
    <h1>Upcoming ACA installment</h1>
    <p>This is a reminder that your scheduled payment of <strong>$${(amount / 100).toFixed(2)}</strong> will be charged on ${dueAt.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'America/Los_Angeles' })}.</p>
  </div>`

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

export const failedInstallmentHtml = ({ amount, graceUntil, paymentUrl }) => `
  <div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6">
    <h1>Action needed for your ACA installment</h1>
    <p>Your scheduled payment of <strong>$${(amount / 100).toFixed(2)}</strong> was not completed.</p>
    <p>Please update or correct your payment method by ${graceUntil.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Los_Angeles' })}. Academy access pauses after this 48-hour correction period and resumes when the payment is brought current.</p>
    <p><a href="${escapeHtml(paymentUrl)}" style="background:#173d62;color:#fff;padding:12px 18px;text-decoration:none">Pay your overdue installment</a></p>
    <p>Correcting this payment does not change the date of your remaining scheduled installment.</p>
  </div>`

export const recoveredInstallmentHtml = ({ nextAmount, nextDueAt, appUrl }) => `
  <div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6">
    <h1>Your ACA payment was received</h1>
    <p>Your Academy access is active. Continue where you left off.</p>
    <p><a href="${escapeHtml(appUrl.replace(/\/$/, '') + '/learn/')}">Open your learner portal</a></p>
    ${nextDueAt ? `<p>Your remaining installment of $${(nextAmount / 100).toFixed(2)} is still scheduled for ${new Date(nextDueAt).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'America/Los_Angeles' })}. Paying late did not change that date.</p>` : '<p>All three installments have been paid. No further installment is due.</p>'}
  </div>`
