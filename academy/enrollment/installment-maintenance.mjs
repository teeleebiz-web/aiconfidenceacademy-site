import { upcomingInstallmentHtml } from './installment-plan.mjs'

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

const authorized = (req, secret) => secret && req.headers.authorization === `Bearer ${secret}`

export async function handleInstallmentMaintenance(req, res, config) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  if (!config?.db || !config?.resend || !config?.emailFrom || !config?.cronSecret) {
    return json(res, 503, { error: 'Installment maintenance is not configured' })
  }
  if (!authorized(req, config.cronSecret)) return json(res, 401, { error: 'Unauthorized' })

  const now = new Date()
  const reminderStart = new Date(now.getTime() + 47 * 60 * 60 * 1000).toISOString()
  const reminderEnd = new Date(now.getTime() + 49 * 60 * 60 * 1000).toISOString()
  const { data: reminders, error: reminderError } = await config.db.from('aca_installment_plans')
    .select('*').eq('status', 'active').gte('next_due_at', reminderStart).lt('next_due_at', reminderEnd)
    .is('reminder_sent_for_due_at', null)
  if (reminderError) return json(res, 500, { error: 'Reminder scan failed' })

  let remindersSent = 0
  for (const plan of reminders || []) {
    const dueAt = new Date(plan.next_due_at)
    const result = await config.resend.emails.send({
      from: config.emailFrom,
      to: plan.customer_email,
      subject: 'Your upcoming ACA installment',
      html: upcomingInstallmentHtml({ amount: plan.next_amount, dueAt }),
    })
    if (!result.error) {
      await config.db.from('aca_installment_plans').update({ reminder_sent_for_due_at: plan.next_due_at }).eq('id', plan.id)
      remindersSent++
    }
  }

  const { data: expired, error: graceError } = await config.db.from('aca_installment_plans')
    .select('id,enrollment_id').eq('status', 'grace').lt('grace_until', now.toISOString())
  if (graceError) return json(res, 500, { error: 'Grace-period scan failed' })
  let accessPaused = 0
  for (const plan of expired || []) {
    const { error } = await config.db.from('enrollments').update({ status: 'paused' }).eq('id', plan.enrollment_id)
    if (!error) {
      await config.db.from('aca_installment_plans').update({ status: 'paused' }).eq('id', plan.id)
      accessPaused++
    }
  }

  return json(res, 200, { remindersSent, accessPaused })
}
