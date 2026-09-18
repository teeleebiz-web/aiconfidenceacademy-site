const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
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

export async function handleStripeEnrollment(req, res, config) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!config?.stripe || !config?.webhookSecret || !config?.phaseOnePriceId || !config?.courseId || !config?.resend || !config?.emailFrom || !config?.appUrl) {
    return json(res, 503, { error: 'Enrollment automation is not configured' })
  }

  let event
  try {
    const raw = await body(req)
    event = config.stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], config.webhookSecret)
  } catch {
    return json(res, 400, { error: 'Invalid webhook signature' })
  }

  if (event.type !== 'checkout.session.completed') return json(res, 200, { received: true })
  const session = event.data.object
  if (session.payment_status !== 'paid') return json(res, 200, { received: true })

  const { data: prior } = await config.db.from('aca_payment_events').select('status').eq('stripe_event_id', event.id).maybeSingle()
  if (prior?.status === 'completed') return json(res, 200, { received: true, duplicate: true })

  const lineItems = await config.stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })
  const purchasedPhaseOne = lineItems.data.some(item => item.price?.id === config.phaseOnePriceId)
  if (!purchasedPhaseOne) return json(res, 200, { received: true, ignored: true })

  const email = session.customer_details?.email ?? session.customer_email
  if (!email) return json(res, 400, { error: 'Paid checkout is missing an email address' })

  await config.db.from('aca_payment_events').upsert({
    stripe_event_id: event.id,
    stripe_session_id: session.id,
    customer_email: email.toLowerCase(),
    amount_total: session.amount_total,
    currency: session.currency,
    status: 'processing',
    error_message: null,
  }, { onConflict: 'stripe_event_id' })

  try {
    const { data: course, error: courseError } = await config.db.from('courses')
      .select('id,status,default_access_days').eq('id', config.courseId).single()
    if (courseError || course?.status !== 'published') throw new Error('Phase One is not open for enrollment')

    const { data: link, error: linkError } = await config.db.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${config.appUrl.replace(/\/$/, '')}/learn/` },
    })
    if (linkError || !link?.user?.id || !link?.properties?.action_link) throw new Error('Learner invitation could not be created')

    const learnerNames = names(session.customer_details?.name)
    const { error: profileError } = await config.db.from('profiles').upsert({
      id: link.user.id,
      ...learnerNames,
      display_name: session.customer_details?.name || learnerNames.first_name,
      account_status: 'active',
    }, { onConflict: 'id' })
    if (profileError) throw profileError

    const startedAt = new Date()
    const expiresAt = course.default_access_days
      ? new Date(startedAt.getTime() + course.default_access_days * 86400000).toISOString()
      : null
    const { error: enrollmentError } = await config.db.from('enrollments').upsert({
      learner_id: link.user.id,
      course_id: config.courseId,
      status: 'active',
      enrolled_at: startedAt.toISOString(),
      starts_at: startedAt.toISOString(),
      access_expires_at: expiresAt,
      completed_at: null,
    }, { onConflict: 'learner_id,course_id' })
    if (enrollmentError) throw enrollmentError

    const { error: emailError } = await config.resend.emails.send({
      from: config.emailFrom,
      to: email,
      subject: 'Your AI Confidence Academy access is ready',
      html: `<div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6"><h1>Welcome to AI Confidence Academy</h1><p>Your Phase One enrollment is active.</p><p><a href="${link.properties.action_link}" style="background:#173d62;color:#fff;padding:12px 18px;text-decoration:none">Open your learner portal</a></p><p>This secure link signs you in. You may also use your Academy password from the learner sign-in page.</p><p>People come first. AI is the tool. Confidence is the product.</p></div>`,
    })
    if (emailError) throw new Error('Welcome email could not be sent')

    await config.db.from('aca_payment_events').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
    return json(res, 200, { received: true, enrolled: true })
  } catch (error) {
    await config.db.from('aca_payment_events').update({ status: 'failed', error_message: error.message }).eq('stripe_event_id', event.id)
    return json(res, 500, { error: 'Enrollment activation failed' })
  }
}
