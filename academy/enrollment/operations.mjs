const reply = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' })
  res.end(JSON.stringify(data))
}

export async function handleEnrollmentOperations(req, res, { db, courseId, reviewerCheck }) {
  if (req.method !== 'GET') return reply(res, 405, { error: 'Method not allowed' })
  const token = req.headers['x-aca-access-token']
  if (typeof token !== 'string' || !token) return reply(res, 401, { error: 'Sign in to your Academy owner account.' })
  if (!db?.auth || !courseId || typeof reviewerCheck !== 'function') return reply(res, 503, { error: 'Enrollment administration is unavailable.' })
  try {
    const identity = await db.auth.getUser(token)
    if (identity.error || !identity.data?.user || identity.data.user.is_anonymous) {
      return reply(res, 401, { error: 'Your Academy session has ended. Please sign in again.' })
    }
    if (!await reviewerCheck(token)) return reply(res, 403, { error: 'Enrollment administration is available to the Academy owner.' })

    const enrollmentResult = await db.from('enrollments')
      .select('id,learner_id,status,enrolled_at,starts_at,access_expires_at,onboarding_completed_at')
      .eq('course_id', courseId).order('created_at', { ascending: false }).limit(101)
    if (enrollmentResult.error) throw enrollmentResult.error
    const enrollments = (enrollmentResult.data || []).slice(0, 100)
    if (!enrollments.length) return reply(res, 200, { records: [], hasMore: false, updatedAt: new Date().toISOString() })
    const ids = enrollments.map(item => item.id)
    const userIds = [...new Set(enrollments.map(item => item.learner_id))]
    const [profiles, plans, emails, ...accounts] = await Promise.all([
      db.from('profiles').select('id,display_name,first_name,account_status').in('id', userIds),
      db.from('aca_installment_plans').select('enrollment_id,status,total_amount,paid_amount,payments_completed,next_due_at,next_amount,grace_until').in('enrollment_id', ids),
      db.from('aca_email_events').select('enrollment_id,subject,status,sent_at,delivered_at,created_at,last_error').in('enrollment_id', ids).order('created_at', { ascending: false }).limit(1000),
      ...userIds.map(id => db.auth.admin.getUserById(id)),
    ])
    if (profiles.error || plans.error || emails.error || accounts.some(item => item.error)) throw new Error('Enrollment records could not be loaded')
    const accountById = new Map(userIds.map((id, index) => [id, accounts[index].data?.user]))
    const addresses = [...new Set(accounts.map(item => item.data?.user?.email?.toLowerCase()).filter(Boolean))]
    const payments = addresses.length ? await db.from('aca_payment_events')
      .select('customer_email,stripe_session_id,amount_total,currency,created_at')
      .eq('status', 'completed').in('customer_email', addresses).order('created_at', { ascending: false }).limit(1000) : { data: [] }
    if (payments.error) throw payments.error
    const records = enrollments.map(enrollment => {
      const profile = (profiles.data || []).find(item => item.id === enrollment.learner_id)
      const account = accountById.get(enrollment.learner_id)
      const email = account?.email?.toLowerCase() || null
      const checkout = (payments.data || []).find(item => item.customer_email === email && /^cs_(test|live)_/.test(item.stripe_session_id))
      const plan = (plans.data || []).find(item => item.enrollment_id === enrollment.id)
      const messages = (emails.data || []).filter(item => item.enrollment_id === enrollment.id).slice(0, 5)
      const now = Date.now()
      const accessStatus = !['active', 'completed'].includes(enrollment.status) ? enrollment.status
        : profile?.account_status !== 'active' ? 'account restricted'
          : enrollment.access_expires_at && Date.parse(enrollment.access_expires_at) <= now ? 'expired'
            : enrollment.starts_at && Date.parse(enrollment.starts_at) > now ? 'scheduled' : 'active'
      return {
        id: enrollment.id, name: profile?.display_name || profile?.first_name || 'Learner', email,
        accountStatus: profile?.account_status || 'unknown', status: enrollment.status, accessStatus,
        startsAt: enrollment.starts_at, expiresAt: enrollment.access_expires_at,
        onboardingCompletedAt: enrollment.onboarding_completed_at,
        invitedAt: account?.invited_at || null, lastSignInAt: account?.last_sign_in_at || null,
        paymentMode: checkout?.stripe_session_id.startsWith('cs_live_') ? 'live' : checkout ? 'sandbox' : 'unrecorded',
        payment: plan ? { kind: 'installments', status: plan.status, total: plan.total_amount, paid: plan.paid_amount,
          completed: plan.payments_completed, nextDueAt: plan.next_due_at, nextAmount: plan.next_amount, graceUntil: plan.grace_until, currency: 'usd' }
          : checkout ? { kind: 'one_time', status: 'paid', total: checkout.amount_total, paid: checkout.amount_total, currency: checkout.currency }
            : null,
        messages: messages.map(({ subject, status, sent_at, delivered_at, created_at, last_error }) => ({
          subject, status, sentAt: sent_at, deliveredAt: delivered_at, recordedAt: created_at,
          error: last_error ? String(last_error).slice(0, 300).replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+\b|\bwhsec_[A-Za-z0-9+/=_-]+\b/g, '[redacted]') : null,
        })),
      }
    })
    return reply(res, 200, { records, hasMore: enrollmentResult.data.length > 100, updatedAt: new Date().toISOString() })
  } catch {
    return reply(res, 503, { error: 'Enrollment administration could not load. Please try again.' })
  }
}
