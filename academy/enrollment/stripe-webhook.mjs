import { attachApprovedInstallmentSchedule, failedInstallmentHtml, installmentConfirmationHtml } from './installment-plan.mjs'
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
  const { data: course, error: courseError } = await config.db.from('courses')
    .select('id,status,default_access_days').eq('id', config.courseId).single()
  if (courseError || course?.status !== 'published') throw new Error('Phase One is not open for enrollment')
  const { data: link, error: linkError } = await config.db.auth.admin.generateLink({
    type: 'invite', email, options: { redirectTo: `${config.appUrl.replace(/\/$/, '')}/learn/` },
  })
  if (linkError || !link?.user?.id || !link?.properties?.action_link) throw new Error('Learner invitation could not be created')
  const learnerNames = names(session.customer_details?.name)
  const { error: profileError } = await config.db.from('profiles').upsert({
    id: link.user.id, ...learnerNames,
    display_name: session.customer_details?.name || learnerNames.first_name,
    account_status: 'active',
  }, { onConflict: 'id' })
  if (profileError) throw profileError
  const startedAt = new Date()
  const expiresAt = course.default_access_days ? new Date(startedAt.getTime() + course.default_access_days * 86400000).toISOString() : null
  const { data: enrollment, error: enrollmentError } = await config.db.from('enrollments').upsert({
    learner_id: link.user.id, course_id: config.courseId, status: 'active',
    enrolled_at: startedAt.toISOString(), starts_at: startedAt.toISOString(),
    access_expires_at: expiresAt, completed_at: null,
  }, { onConflict: 'learner_id,course_id' }).select('id').single()
  if (enrollmentError) throw enrollmentError
  await sendOperationalEmail(config, {
    eventKey: `enrollment-access:${session.id}`, templateKey: 'enrollment_access',
    enrollmentId: enrollment.id, learnerId: link.user.id,
    to: email, subject: 'Your AI Confidence Academy access is ready',
    html: `<div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6"><h1>Welcome to AI Confidence Academy</h1><p>Your Phase One enrollment is active.</p><p><a href="${link.properties.action_link}" style="background:#173d62;color:#fff;padding:12px 18px;text-decoration:none">Open your learner portal</a></p><p>This secure link signs you in. You may also use your Academy password from the learner sign-in page.</p><p>People come first. AI is the tool. Confidence is the product.</p></div>`,
  })
  return { learnerId: link.user.id, enrollmentId: enrollment.id }
}

async function recordEvent(config, event, details) {
  return config.db.from('aca_payment_events').upsert({
    stripe_event_id: event.id, stripe_session_id: details.objectId,
    customer_email: details.email.toLowerCase(), amount_total: details.amount,
    currency: details.currency || 'usd', status: details.status || 'processing', error_message: null,
  }, { onConflict: 'stripe_event_id' })
}

async function checkoutCompleted(event, config) {
  const session = event.data.object
  if (session.payment_status !== 'paid') return { received: true }
  const { data: prior } = await config.db.from('aca_payment_events').select('status').eq('stripe_event_id', event.id).maybeSingle()
  if (prior?.status === 'completed') return { received: true, duplicate: true }
  const lineItems = await config.stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })
  const priceIds = new Set(lineItems.data.map(item => item.price?.id).filter(Boolean))
  const isPaidInFull = priceIds.has(config.phaseOnePriceId)
  const isInstallment = priceIds.has(config.installment50PriceId) && session.metadata?.aca_plan === 'phase_one_installments'
  if (!isPaidInFull && !isInstallment) return { received: true, ignored: true }
  const email = session.customer_details?.email ?? session.customer_email
  if (!email) throw new Error('Paid checkout is missing an email address')
  await recordEvent(config, event, { objectId: session.id, email, amount: session.amount_total, currency: session.currency })
  const access = await activateEnrollment(config, session, email)
  if (isInstallment) {
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    if (!subscriptionId) throw new Error('Installment checkout is missing its Stripe subscription')
    const schedule = await attachApprovedInstallmentSchedule(config.stripe, subscriptionId, config)
    const { error: planError } = await config.db.from('aca_installment_plans').upsert({
      learner_id: access.learnerId, enrollment_id: access.enrollmentId, course_id: config.courseId,
      customer_email: email.toLowerCase(),
      stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      stripe_subscription_id: subscriptionId, stripe_schedule_id: schedule.scheduleId,
      stripe_first_invoice_id: typeof session.invoice === 'string' ? session.invoice : session.invoice?.id,
      status: 'active', total_amount: 14900, paid_amount: 5000, payments_completed: 1,
      second_due_at: schedule.secondDueAt.toISOString(), third_due_at: schedule.thirdDueAt.toISOString(),
      next_due_at: schedule.secondDueAt.toISOString(), next_amount: 5000, grace_until: null,
    }, { onConflict: 'stripe_subscription_id' })
    if (planError) throw planError
    await sendOperationalEmail(config, {
      eventKey: `installment-confirmed:${subscriptionId}`, templateKey: 'installment_confirmation',
      enrollmentId: access.enrollmentId, learnerId: access.learnerId,
      to: email, subject: 'Your ACA installment schedule is confirmed', html: installmentConfirmationHtml(schedule),
    })
  }
  await config.db.from('aca_payment_events').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
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
  const { data: plan } = await config.db.from('aca_installment_plans').select('*').eq('stripe_subscription_id', subscriptionId).maybeSingle()
  if (!plan) return { received: true, ignored: true }
  if (plan.stripe_first_invoice_id && invoice.id === plan.stripe_first_invoice_id) return { received: true, duplicate: true }
  const { data: prior } = await config.db.from('aca_payment_events').select('status').eq('stripe_event_id', event.id).maybeSingle()
  if (prior?.status === 'completed') return { received: true, duplicate: true }
  await recordEvent(config, event, { objectId: invoice.id, email: plan.customer_email, amount: invoice.amount_paid, currency: invoice.currency })
  const completed = Math.min(3, Number(plan.payments_completed || 1) + 1)
  const paidAmount = Number(plan.paid_amount || 5000) + Number(invoice.amount_paid || 0)
  const values = completed >= 3
    ? { status: 'completed', payments_completed: 3, paid_amount: paidAmount, next_due_at: null, next_amount: null, grace_until: null }
    : { status: 'active', payments_completed: completed, paid_amount: paidAmount, next_due_at: plan.third_due_at, next_amount: 4900, grace_until: null, reminder_sent_for_due_at: null }
  const { error } = await config.db.from('aca_installment_plans').update(values).eq('id', plan.id)
  if (error) throw error
  await config.db.from('enrollments').update({ status: 'active' }).eq('id', plan.enrollment_id)
  await config.db.from('aca_payment_events').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
  return { received: true, installmentRecorded: completed }
}

async function invoiceFailed(event, config) {
  const invoice = event.data.object
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  if (!subscriptionId) return { received: true, ignored: true }
  const { data: plan } = await config.db.from('aca_installment_plans').select('*').eq('stripe_subscription_id', subscriptionId).maybeSingle()
  if (!plan) return { received: true, ignored: true }
  const graceUntil = new Date(Date.now() + 48 * 60 * 60 * 1000)
  const amount = Number(invoice.amount_due || plan.next_amount || 0)
  await recordEvent(config, event, { objectId: invoice.id, email: plan.customer_email, amount, currency: invoice.currency, status: 'completed' })
  const { error } = await config.db.from('aca_installment_plans').update({ status: 'grace', grace_until: graceUntil.toISOString() }).eq('id', plan.id)
  if (error) throw error
  await sendOperationalEmail(config, {
    eventKey: `installment-failed:${invoice.id}`, templateKey: 'installment_failed',
    enrollmentId: plan.enrollment_id, learnerId: plan.learner_id,
    to: plan.customer_email, subject: 'Action needed for your ACA installment', html: failedInstallmentHtml({ amount, graceUntil }),
  })
  return { received: true, graceUntil: graceUntil.toISOString() }
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
    if (event.type === 'checkout.session.completed') result = await checkoutCompleted(event, config)
    if (event.type === 'invoice.payment_succeeded') result = await invoiceSucceeded(event, config)
    if (event.type === 'invoice.payment_failed') result = await invoiceFailed(event, config)
    return json(res, 200, result)
  } catch (error) {
    if (event?.id) await config.db.from('aca_payment_events').update({ status: 'failed', error_message: error.message }).eq('stripe_event_id', event.id)
    return json(res, 500, { error: 'Enrollment payment processing failed' })
  }
}
