import { upcomingInstallmentHtml } from './installment-plan.mjs'
import { sendOperationalEmail } from '../email/operational-email.mjs'

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

const authorized = (req, secret) => secret && req.headers.authorization === `Bearer ${secret}`

const calendarDate = value => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value)
  const part = name => parts.find(item => item.type === name).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isInstallmentReminderDue(dueAt, now) {
  const due = new Date(dueAt)
  if (!Number.isFinite(due.getTime()) || due <= now) return false
  const reminderDay = new Date(`${calendarDate(now)}T00:00:00Z`)
  reminderDay.setUTCDate(reminderDay.getUTCDate() + 2)
  return calendarDate(due) <= reminderDay.toISOString().slice(0, 10)
}

export async function handleInstallmentMaintenance(req, res, config, now = new Date()) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  if (!config?.db || !config?.resend || !config?.emailFrom || !config?.cronSecret) {
    return json(res, 503, { error: 'Installment maintenance is not configured' })
  }
  if (!authorized(req, config.cronSecret)) return json(res, 401, { error: 'Unauthorized' })

  const reminderStart = now.toISOString()
  // Include all payment times on the second upcoming local calendar day,
  // including daylight-saving transitions. Earlier unsent reminders can retry.
  const reminderEnd = new Date(now.getTime() + 73 * 60 * 60 * 1000).toISOString()
  const { data: reminders, error: reminderError } = await config.db.from('aca_installment_plans')
    .select('*').eq('status', 'active').gte('next_due_at', reminderStart).lt('next_due_at', reminderEnd)
    .is('reminder_sent_for_due_at', null)
  if (reminderError) return json(res, 500, { error: 'Reminder scan failed' })

  let remindersSent = 0, remindersRecorded = 0, reminderFailures = 0
  for (const plan of reminders || []) {
    const dueAt = new Date(plan.next_due_at)
    if (!isInstallmentReminderDue(dueAt, now)) continue
    try {
      const submission = await sendOperationalEmail(config, {
        eventKey: `installment-reminder:${plan.id}:${plan.next_due_at}`,
        templateKey: 'installment_reminder', enrollmentId: plan.enrollment_id, learnerId: plan.learner_id,
        to: plan.customer_email,
        subject: 'Your upcoming ACA installment',
        html: upcomingInstallmentHtml({ amount: plan.next_amount, dueAt }),
      })
      if (!submission.duplicate) remindersSent++
      const saved = await config.db.from('aca_installment_plans').update({ reminder_sent_for_due_at: plan.next_due_at }).eq('id', plan.id)
      if (saved.error) throw saved.error
      remindersRecorded++
    } catch { reminderFailures++ }
  }

  const { data: expired, error: graceError } = await config.db.from('aca_installment_plans')
    .select('id,enrollment_id').eq('status', 'grace').lt('grace_until', now.toISOString())
  if (graceError) return json(res, 500, { error: 'Grace-period scan failed', remindersSent, remindersRecorded, reminderFailures, failed: reminderFailures + 1 })
  let accessPaused = 0, pauseFailures = 0
  for (const plan of expired || []) {
    try {
      const enrollment = await config.db.from('enrollments').update({ status: 'paused' }).eq('id', plan.enrollment_id)
      if (enrollment.error) throw enrollment.error
      const saved = await config.db.from('aca_installment_plans').update({ status: 'paused' }).eq('id', plan.id)
      if (saved.error) throw saved.error
      accessPaused++
    } catch { pauseFailures++ }
  }

  return json(res, 200, { remindersSent, remindersRecorded, accessPaused, reminderFailures, pauseFailures, failed: reminderFailures + pauseFailures })
}
