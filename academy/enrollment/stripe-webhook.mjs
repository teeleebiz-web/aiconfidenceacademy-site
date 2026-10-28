import { enrollmentOffer, phaseTwoConfig, installmentAmounts } from './offers.mjs'
import { attachApprovedInstallmentSchedule, failedInstallmentHtml, installmentConfirmationHtml, recoveredInstallmentHtml } from './installment-plan.mjs'
import { sendOperationalEmail } from '../email/operational-email.mjs'

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}
const body = req => new Promise((resolve, reject) => {
  const chunks = []
  req.on('data', chunk => chunks.push(chunk))
  req.on('end', () => resolve(Buffer.concat(chunks)))
  req.on('error', reject)
})
const names = fullName => {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return { first_name: parts[0] || null, last_name: parts.slice(1).join(' ') || null }
}
async function activateEnrollment(config, session, email) {
  const { data: accessEmail, error: accessEmailError } = await config.db.from('aca_email_events')
    .select('status,learner_id,enrollment_id').eq('event_key', `enrollment-access:${session.id}`).maybeSingle()
  if (accessEmailError) throw accessEmailError
  if (accessEmail?.learner_id && accessEmail?.enrollment_id && ['sent', 'delivered'].includes(accessEmail.status)) {
    return { learnerId: accessEmail.learner_id, enrollmentId: accessEmail.enrollment_id }
  }
  const { data: course, error: courseError } = await config.db.from('courses')
    .select('id,status,default_access_days').eq('id', config.courseId).single()
  if (courseError || course?.status !== 'published') throw new Error(`${enrollmentOffer(config).label} is not open for enrollment`)
  let cohort
  if (enrollmentOffer(config).phaseNumber === 2) {
    const result = await config.db.from('aca_phase_two_cohorts').select('id,status,course_id').eq('id', session.metadata?.aca_cohort_id).eq('course_id', config.courseId).single()
    if (result.error || result.data?.status !== 'active') throw new Error('Phase Two cohort is unavailable')
    cohort = result.data
  }
  const options = { redirectTo: `${config.appUrl.replace(/\/$/, '')}${enrollmentOffer(config).portalPath}` }
  let { data: link, error: linkError } = await config.db.auth.admin.generateLink({
    type: 'invite', email, options,
  })
  if (['email_exists', 'user_already_exists'].includes(linkError?.code)) {
    ;({ data: link, error: linkError } = await config.db.auth.admin.generateLink({ type: 'magiclink', email, options }))
  }
  if (linkError || !link?.user?.id || !link?.properties?.action_link) throw new Error('Learner invitation could not be created')
  const learnerNames = names(session.customer_details?.name)
  const { error: profileError } = await config.db.from('profiles').upsert({
    id: link.user.id, ...learnerNames,
    display_name: session.customer_details?.name || learnerNames.first_name,
    account_status: 'active',
  }, { onConflict: 'id' })
  if (profileError) throw profileError
  const { data: existingEnrollment, error: lookupError } = await config.db.from('enrollments')
    .select('id,enrolled_at,starts_at,access_expires_at,completed_at,status').eq('learner_id', link.user.id).eq('course_id', config.courseId).maybeSingle()
  if (lookupError) throw lookupError
  const startedAt = new Date()
  const expiresAt = course.default_access_days ? new Date(startedAt.getTime() + course.default_access_days * 86400000).toISOString() : null
  const { data: enrollment, error: enrollmentError } = await config.db.from('enrollments').upsert({
    learner_id: link.user.id, course_id: config.courseId, status: existingEnrollment?.status === 'completed' ? 'completed' : 'active',
    enrolled_at: existingEnrollment?.enrolled_at ?? startedAt.toISOString(), starts_at: existingEnrollment?.starts_at ?? startedAt.toISOString(),
    access_expires_at: existingEnrollment ? existingEnrollment.access_expires_at : expiresAt, completed_at: existingEnrollment?.completed_at ?? null,
  }, { onConflict: 'learner_id,course_id' }).select('id').single()
  if (enrollmentError) throw enrollmentError
  if (cohort) {
    const {data: membership, error: membershipError} = await config.db.from('aca_phase_two_memberships').select('cohort_id').eq('enrollment_id', enrollment.id).maybeSingle()
    if (membershipError) throw membershipError
    if (membership && membership.cohort_id !== cohort.id) throw new Error('Existing Phase Two cohort cannot be reassigned by a purchase')
    if (!membership) {
      const {error} = await config.db.from('aca_phase_two_memberships').insert({enrollment_id: enrollment.id, learner_id: link.user.id, course_id: config.courseId, cohort_id: cohort.id})
      if (error) throw error
    }
  }
  await sendOperationalEmail(config, {
    eventKey: `enrollment-access:${session.id}`, templateKey: 'enrollment_access',
    enrollmentId: enrollment.id, learnerId: link.user.id,
    to: email, subject: 'Your AI Confidence Academy access is ready',
    html: `<div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6"><h1>Welcome to AI Confidence Academy</h1><p>Your ${enrollmentOffer(config).label} enrollment is active.</p><p><a href="${link.properties.action_link}" style="background:#173d62;color:#fff;padding:12px 18px;text-decoration:none">Open your learner portal</a></p><p>This secure link signs you in. You may also use your Academy password from the learner sign-in page.</p><p>People come first. AI is the tool. Confidence is the product.</p></div>`,
  })
  return { learnerId: link.user.id, enrollmentId: enrollment.id }
}

async function recordEvent(config, event, details) {
  const { error } = await config.db.from('aca_payment_events').upsert({
    stripe_event_id: event.id, stripe_session_id: details.objectId,
    customer_email: details.email.toLowerCase(), amount_total: details.amount,
    currency: details.currency || 'usd', status: details.status || 'processing', error_message: null,
    event_type: event.type || null, livemode: typeof event.livemode === 'boolean' ? event.livemode : null,
    outcome: details.outcome || 'processed', course_id: config.courseId,
  }, { onConflict: 'stripe_event_id' })
  if (error) throw error
}

async function completeEvent(config, event) {
  const { error } = await config.db.from('aca_payment_events').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
  if (error) throw error
}

async function checkoutCompleted(event, config) {
  const session = event.data.object
  if (session.payment_status !== 'paid') return { received: true }
  const { data: prior, error: priorError } = await config.db.from('aca_payment_events').select('status')
    .eq('stripe_session_id', session.id).eq('status', 'completed').limit(1).maybeSingle()
  if (priorError) throw priorError
  if (prior) return { received: true, duplicate: true }
  const lineItems = await config.stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })
  const priceIds = new Set(lineItems.data.map(item => item.price?.id).filter(Boolean))
  if (config.phaseTwoCourseId && [config.phaseTwoPaidInFullPriceId, config.phaseTwoStandardPriceId, config.installment67PriceId].some(id => id && priceIds.has(id))) config = phaseTwoConfig(config)
  const offer = enrollmentOffer(config)
  if (offer.phaseNumber === 2 && (lineItems.has_more || lineItems.data.length !== 1 || session.metadata?.aca_course_id !== config.courseId)) throw new Error('Phase Two checkout course does not match its approved price')
  const isPaidInFull = offer.phaseNumber === 2 ? priceIds.has(config.phaseTwoPaidInFullPriceId) : priceIds.has(config.phaseOnePriceId) || (config.phaseOneFoundingPriceId && priceIds.has(config.phaseOneFoundingPriceId))
  const isInstallment = priceIds.has(offer.priceIds[0]) && session.metadata?.aca_plan === `${offer.planPrefix}_installments`
  if (!isPaidInFull && !isInstallment) return { received: true, ignored: true }
  if (offer.phaseNumber === 2 && (session.currency !== 'usd' || session.amount_total !== (isInstallment ? offer.amounts[0] : offer.paidInFullAmount))) throw new Error('Phase Two checkout amount does not match the approved purchase')
  const email = session.customer_details?.email ?? session.customer_email
  if (!email) throw new Error('Paid checkout is missing an email address')
  await recordEvent(config, event, { objectId: session.id, email, amount: session.amount_total, currency: session.currency, outcome: 'paid' })
  const access = await activateEnrollment(config, session, email)
  if (isInstallment) {
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    if (!subscriptionId) throw new Error('Installment checkout is missing its Stripe subscription')
    const { data: existingPlan, error: existingPlanError } = await config.db.from('aca_installment_plans')
      .select('stripe_schedule_id,second_due_at,third_due_at').eq('stripe_subscription_id', subscriptionId).maybeSingle()
    if (existingPlanError) throw existingPlanError
    const schedule = existingPlan ? {
      scheduleId: existingPlan.stripe_schedule_id,
      secondDueAt: new Date(existingPlan.second_due_at), thirdDueAt: new Date(existingPlan.third_due_at),
    } : await attachApprovedInstallmentSchedule(config.stripe, subscriptionId, config)
    if (!existingPlan) {
      const { error: planError } = await config.db.from('aca_installment_plans').upsert({
        learner_id: access.learnerId, enrollment_id: access.enrollmentId, course_id: config.courseId,
        customer_email: email.toLowerCase(),
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        stripe_subscription_id: subscriptionId, stripe_schedule_id: schedule.scheduleId,
        stripe_first_invoice_id: typeof session.invoice === 'string' ? session.invoice : session.invoice?.id,
        status: 'active', total_amount: offer.totalAmount, paid_amount: offer.amounts[0], payments_completed: 1,
        second_due_at: schedule.secondDueAt.toISOString(), third_due_at: schedule.thirdDueAt.toISOString(),
        next_due_at: schedule.secondDueAt.toISOString(), next_amount: offer.amounts[1], grace_until: null,
      }, { onConflict: 'stripe_subscription_id' })
      if (planError) throw planError
    }
    await sendOperationalEmail(config, {
      eventKey: `installment-confirmed:${subscriptionId}`, templateKey: 'installment_confirmation',
      enrollmentId: access.enrollmentId, learnerId: access.learnerId,
      to: email, subject: 'Your ACA installment schedule is confirmed', html: installmentConfirmationHtml({ ...schedule, amounts: offer.amounts }),
    })
  }
  await completeEvent(config, event)
  return { received: true, enrolled: true, plan: isInstallment ? 'installments' : 'paid_in_full' }
}

const subscriptionIdFromInvoice = invoice => {
  const legacy = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  return legacy || invoice.parent?.subscription_details?.subscription || null
}

async function invoiceSucceeded(event, config) {
  const invoice = event.data.object
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  if (!subscriptionId) return { received: true, ignored: true }
  const { data: plan, error: planLookupError } = await config.db.from('aca_installment_plans').select('*').eq('stripe_subscription_id', subscriptionId).maybeSingle()
  if (planLookupError) throw planLookupError
  if (!plan) return { received: true, ignored: true }
  if (plan.status === 'canceled') return { received: true, ignored: true }
  if (plan.stripe_first_invoice_id && invoice.id === plan.stripe_first_invoice_id) return { received: true, duplicate: true }
  const { data: prior, error: priorLookupError } = await config.db.from('aca_payment_events').select('status').eq('stripe_event_id', event.id).maybeSingle()
  if (priorLookupError) throw priorLookupError
  if (prior?.status === 'completed') return { received: true, duplicate: true }
  config = { ...config, courseId: plan.course_id || config.courseId }
  await recordEvent(config, event, { objectId: invoice.id, email: plan.customer_email, amount: invoice.amount_paid, currency: invoice.currency, outcome: 'paid' })
  const amounts = installmentAmounts(plan)
  const totalAmount = amounts.reduce((a,b) => a+b, 0)
  // Reconcile against Stripe's paid invoices, so a retry after a partial database
  // failure cannot count the same invoice as another installment.
  const paidInvoices = await config.stripe.invoices.list({ subscription: subscriptionId, status: 'paid', limit: 100 })
  const payments = paidInvoices.data.filter(item => item.amount_paid > 0)
  if (paidInvoices.has_more || !payments.some(item => item.id === invoice.id)
    || payments.some(item => item.currency !== 'usd' || !amounts.includes(item.amount_paid))) {
    throw new Error('The paid installment invoices could not be reconciled')
  }
  const completed = payments.length
  const paidAmount = payments.reduce((total, item) => total + item.amount_paid, 0)
  if (completed < 1 || completed > 3 || (completed === 1 && paidAmount !== amounts[0])
    || (completed === 2 && ![amounts[0] + amounts[1], amounts[0] + amounts[2]].includes(paidAmount)) || (completed === 3 && paidAmount !== totalAmount)) {
    throw new Error('The paid installment total does not match the approved schedule')
  }
  const finalInstallmentPaid = totalAmount === 14900
    ? payments.some(item => item.amount_paid === amounts[2])
    : payments.some(item => item.id !== plan.stripe_first_invoice_id && Number(item.period_start) >= Date.parse(plan.third_due_at) / 1000)
  const values = completed >= 3
    ? { status: 'completed', payments_completed: 3, paid_amount: paidAmount, next_due_at: null, next_amount: null, grace_until: null }
    : { status: 'active', payments_completed: completed, paid_amount: paidAmount,
      next_due_at: completed === 1 || finalInstallmentPaid ? plan.second_due_at : plan.third_due_at,
      next_amount: completed === 1 || finalInstallmentPaid ? amounts[1] : amounts[2],
      grace_until: null, reminder_sent_for_due_at: null }
  const { error } = await config.db.from('aca_installment_plans').update(values).eq('id', plan.id).lte('payments_completed', completed)
  if (error) throw error
  const { error: accessError } = await config.db.from('enrollments').update({ status: 'active' }).eq('id', plan.enrollment_id).eq('status', 'paused')
  if (accessError) throw accessError
  const { data: failedEmail, error: emailLookupError } = await config.db.from('aca_email_events')
    .select('id').eq('event_key', `installment-failed:${invoice.id}`).maybeSingle()
  if (emailLookupError) throw emailLookupError
  if (plan.status === 'grace' || plan.status === 'paused' || failedEmail) {
    await sendOperationalEmail(config, {
      eventKey: `installment-recovered:${invoice.id}`, templateKey: 'installment_recovered',
      enrollmentId: plan.enrollment_id, learnerId: plan.learner_id,
      to: plan.customer_email, subject: 'Your ACA payment was received — access is active',
      html: recoveredInstallmentHtml({ nextAmount: values.next_amount, nextDueAt: values.next_due_at, appUrl: config.appUrl, portalPath: plan.total_amount === 19900 ? "/learn/?course=phase-two" : "/learn/" }),
    })
  }
  await completeEvent(config, event)
  return { received: true, installmentRecorded: completed }
}

async function invoiceFailed(event, config) {
  const invoice = event.data.object
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  if (!subscriptionId) return { received: true, ignored: true }
  const { data: plan, error: planLookupError } = await config.db.from('aca_installment_plans').select('*').eq('stripe_subscription_id', subscriptionId).maybeSingle()
  if (planLookupError) throw planLookupError
  if (!plan) return { received: true, ignored: true }
  if (plan.status === 'completed') return { received: true, ignored: true }
  const { data: prior, error: priorLookupError } = await config.db.from('aca_payment_events').select('status').eq('stripe_event_id', event.id).maybeSingle()
  if (priorLookupError) throw priorLookupError
  if (prior?.status === 'completed') return { received: true, duplicate: true }
  config = { ...config, courseId: plan.course_id || config.courseId }
  const currentInvoice = await config.stripe.invoices.retrieve(invoice.id)
  if (currentInvoice.status === 'paid') return { received: true, ignored: true }
  const paymentUrl = currentInvoice.hosted_invoice_url
  if (!paymentUrl || new URL(paymentUrl).protocol !== 'https:' || new URL(paymentUrl).hostname !== 'invoice.stripe.com') {
    throw new Error('Stripe payment-correction link is unavailable')
  }
  const graceUntil = plan.grace_until && ['grace', 'paused'].includes(plan.status)
    ? new Date(plan.grace_until) : new Date(Date.now() + 48 * 60 * 60 * 1000)
  const amount = Number(invoice.amount_due || plan.next_amount || 0)
  await recordEvent(config, event, { objectId: invoice.id, email: plan.customer_email, amount, currency: invoice.currency, outcome: 'failed' })
  const { error } = await config.db.from('aca_installment_plans').update({ status: plan.status === 'paused' ? 'paused' : 'grace', grace_until: graceUntil.toISOString() }).eq('id', plan.id)
  if (error) throw error
  await sendOperationalEmail(config, {
    eventKey: `installment-failed:${invoice.id}`, templateKey: 'installment_failed',
    enrollmentId: plan.enrollment_id, learnerId: plan.learner_id,
    to: plan.customer_email, subject: 'Action needed for your ACA installment', html: failedInstallmentHtml({ amount, graceUntil, paymentUrl }),
  })
  await completeEvent(config, event)
  return { received: true, graceUntil: graceUntil.toISOString() }
}

export async function recordStripeRefund(event, config) {
  const object = event.data.object
  const refunds = event.type === 'charge.refunded' ? (object.refunds?.data || []) : [object]
  for (const refund of refunds) {
    const values = { provider_refund_id: refund.id, charge_id: typeof refund.charge === 'string' ? refund.charge : refund.charge?.id || (event.type === 'charge.refunded' ? object.id : null),
      amount: refund.amount, currency: refund.currency || object.currency, livemode: event.livemode === true,
      status: refund.status || 'pending', updated_at: new Date().toISOString() }
    const email = object.billing_details?.email || object.receipt_email
    if (email) values.customer_email = email.toLowerCase()
    const {error} = await config.db.rpc('aca_record_refund', {p_refund:values,p_created:Number(event.created)||Math.floor(Date.now()/1000)})
    if (error) throw error
  }
  return {received:true,refundsRecorded:refunds.length}
}

export async function handleStripeEnrollment(req, res, config) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!config?.stripe || !config?.webhookSecret || !config?.phaseOnePriceId || !config?.courseId || !config?.resend || !config?.emailFrom || !config?.appUrl) {
    return json(res, 503, { error: 'Enrollment automation is not configured' })
  }
  let event
  try { event = config.stripe.webhooks.constructEvent(await body(req), req.headers['stripe-signature'], config.webhookSecret) }
  catch { return json(res, 400, { error: 'Invalid webhook signature' }) }
  try {
    let result = { received: true }
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) result = await checkoutCompleted(event, config)
    if (event.type === 'invoice.payment_succeeded') result = await invoiceSucceeded(event, config)
    if (event.type === 'invoice.payment_failed') result = await invoiceFailed(event, config)
    if (['charge.refunded', 'refund.created', 'refund.updated', 'refund.failed'].includes(event.type)) result = await recordStripeRefund(event, config)
    return json(res, 200, result)
  } catch (error) {
    if (event?.id) await config.db.from('aca_payment_events').update({ status: 'failed', error_message: error.message }).eq('stripe_event_id', event.id)
    return json(res, 500, { error: 'Enrollment payment processing failed' })
  }
}
