import { enrollmentOffer, checkEnrollmentOpen } from './offers.mjs'
import { randomInt } from 'node:crypto'

const integrationSuffix = Array.from({ length: 8 }, () => String.fromCharCode(97 + randomInt(26))).join('')

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

export const enrollmentPolicyVersion = '2026-10-30'
async function agreement(req, config) {
  try {
    let raw = ''
    if (req.body !== undefined) raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? String(req.body) : new URLSearchParams(req.body).toString()
    else for await (const chunk of req) { raw += chunk; if (raw.length > 4096) return null }
    if (raw.length > 4096) return null
    const values = new URLSearchParams(raw)
    const version = values.get('policyVersion')
    const acceptedVersions = config?.phaseNumber === 2 ? [enrollmentPolicyVersion, '2026-10-29', '2026-10-28'] : [enrollmentPolicyVersion, '2026-10-29', '2026-10-28', '2026-10-17']
    if (values.get('termsAccepted') !== 'yes' || values.get('ageConfirmed') !== 'yes' || !acceptedVersions.includes(version)) return null
    return { aca_policy_version: version, aca_terms_accepted_at: new Date().toISOString(), aca_age_18_or_older: 'yes' }
  } catch { return null }
}

export async function handleInstallmentCheckout(req, res, config) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  const offer = enrollmentOffer(config)
  if (!config?.stripe || offer.priceIds.some(id => !id) || !config?.appUrl) {
    return json(res, 503, { error: 'Installment enrollment is not configured' })
  }

  const expectedOrigin = appOrigin(config.appUrl)
  const suppliedOrigin = appOrigin(req.headers.origin || req.headers.referer)
  if (!expectedOrigin || suppliedOrigin !== expectedOrigin) {
    return json(res, 403, { error: 'Request origin was not accepted' })
  }

  const accepted = await agreement(req, config)
  if (!accepted) return json(res, 400, { error: 'Reload the enrollment page, confirm that you are 18 or older, and accept the Terms, Privacy Policy, and Refund Policy.' })

  try {
    if (!await checkEnrollmentOpen(config)) return json(res, 503, { error: 'Phase Two enrollment is closed. No payment has been taken.' })
    if (offer.phaseNumber === 2) {
      for (const [index, id] of offer.priceIds.entries()) {
        const price = await config.stripe.prices.retrieve(id)
        if (!price.active || price.currency !== 'usd' || price.unit_amount !== offer.amounts[index] || price.tax_behavior !== 'inclusive' || price.recurring?.interval !== 'week' || price.recurring?.interval_count !== 1) throw new Error('The approved weekly installment prices are not configured')
      }
    }
    const session = await config.stripe.checkout.sessions.create({
      mode: 'subscription',
      integration_identifier: `aca_${offer.planPrefix}_${integrationSuffix}`,
      line_items: [{ price: offer.priceIds[0], quantity: 1 }],
      success_url: `${config.appUrl.replace(/\/$/, '')}/enroll/?payment=success`,
      cancel_url: `${config.appUrl.replace(/\/$/, '')}/enroll/?payment=canceled`,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: {
          ...accepted,
          aca_plan: `${offer.planPrefix}_installments`,
          aca_course_id: config.courseId,
          ...(offer.phaseNumber === 2 ? { aca_cohort_id: config.phaseTwoCohortId } : {}),
          aca_total_cents: String(offer.totalAmount),
        },
      },
      metadata: {
        ...accepted,
        aca_plan: `${offer.planPrefix}_installments`,
        aca_course_id: config.courseId,
        ...(offer.phaseNumber === 2 ? { aca_cohort_id: config.phaseTwoCohortId } : {}),
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
  const offer = enrollmentOffer(config)
  const priceId = offer.paidInFullPriceId
  if (!config?.stripe || !priceId || !config?.appUrl) {
    return json(res, 503, { error: 'Pay-in-full enrollment is not configured' })
  }
  const expectedOrigin = appOrigin(config.appUrl)
  const suppliedOrigin = appOrigin(req.headers.origin || req.headers.referer)
  if (!expectedOrigin || suppliedOrigin !== expectedOrigin) return json(res, 403, { error: 'Request origin was not accepted' })
  const accepted = await agreement(req, config)
  if (!accepted) return json(res, 400, { error: 'Reload the enrollment page, confirm that you are 18 or older, and accept the Terms, Privacy Policy, and Refund Policy.' })
  try {
    if (!await checkEnrollmentOpen(config)) return json(res, 503, { error: 'Phase Two enrollment is closed. No payment has been taken.' })
    const price = await config.stripe.prices.retrieve(priceId)
    if (!price.active || price.currency !== 'usd' || price.unit_amount !== offer.paidInFullAmount || price.type !== 'one_time' || (offer.phaseNumber === 2 && price.tax_behavior !== 'inclusive')) {
      throw new Error('The approved pay-in-full price is not configured')
    }
    const session = await config.stripe.checkout.sessions.create({
      mode: 'payment',
      integration_identifier: `aca_${offer.planPrefix}_${integrationSuffix}`,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.appUrl.replace(/\/$/, '')}/enroll/?payment=success`,
      cancel_url: `${config.appUrl.replace(/\/$/, '')}/enroll/?payment=canceled`,
      billing_address_collection: 'auto',
      metadata: { ...accepted, aca_plan: `${offer.planPrefix}_paid_in_full`, aca_course_id: config.courseId,
          ...(offer.phaseNumber === 2 ? { aca_cohort_id: config.phaseTwoCohortId } : {}), aca_offer: 'pay_in_full', aca_total_cents: String(offer.paidInFullAmount) },
    })
    res.writeHead(303, { Location: session.url, 'Cache-Control': 'no-store' })
    res.end()
  } catch (error) {
    logCheckoutFailure('one-time', error)
    return json(res, 502, { error: 'The secure pay-in-full checkout could not be opened' })
  }
}

export async function attachApprovedInstallmentSchedule(stripe, subscriptionId, prices) {
  const offer = enrollmentOffer(prices)
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
        items: [{ price: offer.priceIds[0], quantity: 1 }],
        start_date: schedule.current_phase.start_date,
        end_date: schedule.current_phase.end_date,
        proration_behavior: 'none',
        metadata: { aca_installment_number: '1' },
      },
      {
        items: [{ price: offer.priceIds[1], quantity: 1 }],
        duration: { interval: 'week', interval_count: 1 },
        proration_behavior: 'none',
        metadata: { aca_installment_number: '2' },
      },
      {
        items: [{ price: offer.priceIds[2], quantity: 1 }],
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

export const installmentConfirmationHtml = ({ secondDueAt, thirdDueAt, amounts = [5000, 5000, 4900] }) => `
  <div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6">
    <h1>Your ACA installment plan is confirmed</h1>
    <p>Your first $${(amounts[0] / 100).toFixed(2)} payment was received.</p>
    <ul>
      <li>$${(amounts[1] / 100).toFixed(2)} on ${secondDueAt.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'America/Los_Angeles' })}</li>
      <li>$${(amounts[2] / 100).toFixed(2)} on ${thirdDueAt.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'America/Los_Angeles' })}</li>
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

export const recoveredInstallmentHtml = ({ nextAmount, nextDueAt, appUrl, portalPath = "/learn/" }) => `
  <div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6">
    <h1>Your ACA payment was received</h1>
    <p>Your Academy access is active. Continue where you left off.</p>
    <p><a href="${escapeHtml(appUrl.replace(/\/$/, '') + portalPath)}">Open your learner portal</a></p>
    ${nextDueAt ? `<p>Your remaining installment of $${(nextAmount / 100).toFixed(2)} is still scheduled for ${new Date(nextDueAt).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'America/Los_Angeles' })}. Paying late did not change that date.</p>` : '<p>All three installments have been paid. No further installment is due.</p>'}
  </div>`
