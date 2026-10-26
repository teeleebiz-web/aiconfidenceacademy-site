import { createHash } from 'node:crypto'
import { sendOperationalEmail } from './operational-email.mjs'

// Mirror the existing daily UTC schedules; these checks never invoke those jobs.
export const monitoredJobs = {
  'installment-maintenance': { hour: 9, label: 'Installment processing' },
  'lesson-releases': { hour: 16, label: 'Release notification delivery' },
  'newsletter-maintenance': { hour: 18, label: 'Newsletter processing' },
  'storage-backups': { hour: 18, minute: 17, stalledMinutes: 45, label: 'Private file backups' },
}
const reasons = {
  job_failed: 'The scheduled task failed.',
  job_warning: 'The scheduled task reported a partial failure or an outcome needing review.',
  run_missing: 'No run was recorded after the scheduled time and its two-hour allowance.',
  run_stalled: 'A recorded run has exceeded its expected completion window.',
  history_failed: 'The task ran, but its activity record could not be saved.',
  credential_expiring: 'The private backup credential expires within three days or has expired. Review the bucket-scoped R2 credential before the next backup.',
  verification_test: 'This is a planned backup-alert delivery test. No backup failure is being reported.',
}
const checked = result => { if (result.error) throw result.error; return result.data }
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16)
const hour = 3600000
const failures = new Set(['bounced', 'complained', 'suppressed', 'failed'])

export function scheduledSlot(job, now, allowance = 0) {
  const scheduled = new Date(now)
  scheduled.setUTCHours(monitoredJobs[job].hour, monitoredJobs[job].minute ?? 0, 0, 0)
  if (scheduled.getTime() + allowance > now.getTime()) scheduled.setUTCDate(scheduled.getUTCDate() - 1)
  return scheduled.toISOString()
}

export async function queueOperationalAlert(config, { job, reason, runId = null, occurredAt = new Date().toISOString() }) {
  if (!monitoredJobs[job] || !reasons[reason]) return
  if (reason === 'verification_test' && job !== 'storage-backups') return
  const recipients = checked(await config.db.rpc('aca_support_alert_recipients'))
  if (!Array.isArray(recipients) || !recipients.length) throw new Error('No trusted alert recipients')
  const slot = scheduledSlot(job, new Date(occurredAt))
  for (const { email } of recipients) {
    const recipient = String(email).trim().toLowerCase()
    // Coalesce repeated failures of the same daily task, independently for each owner.
    checked(await config.db.from('aca_operational_alerts').upsert({
      event_key: `${job}:${slot}:${reason}:${hash(recipient)}`,
      job, reason, run_id: runId, occurred_at: occurredAt, recipient,
    }, { onConflict: 'event_key', ignoreDuplicates: true }))
  }
}

async function settle(config, alert, values) {
  const row = checked(await config.db.from('aca_operational_alerts').update({
    ...values, claim_token: null, claim_expires_at: null,
  }).eq('id', alert.id).eq('claim_token', alert.claim_token).select('id').maybeSingle())
  if (!row) throw new Error('Alert claim changed')
}

export async function dispatchOperationalAlerts(config, now = new Date()) {
  if (!config?.resend || !config.emailFrom || !config.appUrl) throw new Error('Alert email is not configured')
  const recipients = checked(await config.db.rpc('aca_support_alert_recipients'))
  const trusted = new Set(recipients.map(({ email }) => String(email).trim().toLowerCase()))
  if (!trusted.size) throw new Error('No trusted alert recipients')
  const alerts = checked(await config.db.rpc('aca_claim_operational_alerts'))
  const result = { submitted: 0, retry: 0, review: 0 }
  for (const alert of alerts) {
    try {
      if (!trusted.has(alert.recipient)) {
        await settle(config, alert, { status: 'review', last_error: 'Recipient is no longer an authorized owner.' })
        result.review++
        continue
      }
      const eventKey = `operations-alert:${alert.id}`
      const email = checked(await config.db.from('aca_email_events').select('id,status,provider_message_id,created_at').eq('event_key', eventKey).maybeSingle())
      // A provider reference proves submission, including later delivery failures.
      // Do not automatically resend a bounced or complained-about notification.
      if (email?.provider_message_id || ['sent', 'delivered'].includes(email?.status)) {
        const review = failures.has(email.status)
        await settle(config, alert, { status: review ? 'review' : 'sent', sent_at: review ? null : now.toISOString(), last_error: review ? 'Alert delivery needs review.' : null })
        result[review ? 'review' : 'submitted']++
        continue
      }
      // Resend retains keys for 24 hours. Leave uncertain older attempts for review.
      // first_attempt_at is set before sending and survives process interruption.
      // A later rejection cannot disprove acceptance of an earlier lost response.
      if (email && now.getTime() - Date.parse(alert.first_attempt_at) >= 23 * hour) {
        await settle(config, alert, { status: 'review', last_error: 'Earlier email submission could not be confirmed safely.' })
        result.review++
        continue
      }
      const label = monitoredJobs[alert.job].label
      const title = alert.reason === 'verification_test' ? 'ACA backup alert delivery test' : 'ACA system needs review'
      const control = new URL('/control-center/', config.appUrl).href
      // A malformed success response is uncertain, never proof of submission.
      const mailConfig = { ...config, resend: { emails: { async send(...args) {
        const response = await config.resend.emails.send(...args)
        if (!response?.error && !(response?.data?.id || response?.id)) throw new Error('Email submission is uncertain')
        return response
      } } } }
      await sendOperationalEmail(mailConfig, {
        eventKey, templateKey: 'automation_owner_alert', to: alert.recipient,
        subject: `${title} · ${label}`,
        metadata: { operational_alert_id: alert.id, automation_job: alert.job, reason: alert.reason },
        html: `<div style="font-family:Arial,sans-serif;color:#102d4f;line-height:1.6"><h1>${title}</h1><p>${escape(label)}: ${escape(reasons[alert.reason])}</p><p>Recorded: ${escape(alert.occurred_at)}. Reference: ${escape(alert.id.slice(0, 8))}.</p><p><a href="${escape(control)}">Open the control center</a> and select System activity. Email center shows notification submission and delivery separately.</p></div>`,
      })
      await settle(config, alert, { status: 'sent', sent_at: now.toISOString(), last_error: null })
      result.submitted++
    } catch {
      const review = alert.attempts >= 3
      // Never include provider responses, learner details, or credentials in alerts.
      await settle(config, alert, { status: review ? 'review' : 'queued', next_attempt_at: new Date(now.getTime() + 15 * 60000).toISOString(), last_error: 'Alert email could not be confirmed.' })
      result[review ? 'review' : 'retry']++
    }
  }
  const review = await config.db.from('aca_operational_alerts').select('id', { count: 'exact', head: true }).eq('status', 'review')
  if (review.error) throw review.error
  result.review = review.count
  return result
}

export async function checkOperationalRuns(config, now = new Date()) {
  const monitor = checked(await config.db.from('aca_operational_monitor').select('activated_at').eq('id', true).single())
  let issues = 0
  for (const job of Object.keys(monitoredJobs)) {
    let activatedAt = monitor.activated_at
    if (job === 'storage-backups') {
      const policy = checked(await config.db.from('aca_backup_automation').select('enabled,activated_at,credential_expires_at').eq('id', true).single())
      if (!policy.enabled) continue
      if (!policy.activated_at) throw new Error('Backup activation is incomplete')
      activatedAt = policy.activated_at
      if (policy.credential_expires_at && Date.parse(policy.credential_expires_at) <= now.getTime() + 72 * hour) {
        await queueOperationalAlert(config, { job, reason: 'credential_expiring', occurredAt: now.toISOString() })
        issues++
      }
    }
    const slot = scheduledSlot(job, now, 2 * hour)
    if (Date.parse(slot) < Date.parse(activatedAt)) continue
    const runs = checked(await config.db.from('aca_automation_runs').select('id,status,started_at,finished_at').eq('job', job).gte('started_at', slot).lte('started_at', now.toISOString()).order('started_at', { ascending: false }).limit(100))
    if (!runs.length) {
      await queueOperationalAlert(config, { job, reason: 'run_missing', occurredAt: slot })
      issues++
    }
    for (const run of runs) {
      const reason = ['failed', 'warning'].includes(run.status) ? `job_${run.status}` : !run.finished_at && now.getTime() - Date.parse(run.started_at) > (monitoredJobs[job].stalledMinutes ?? 15) * 60000 ? 'run_stalled' : null
      if (reason) {
        await queueOperationalAlert(config, { job, reason, runId: run.id, occurredAt: run.started_at })
        issues++
      }
    }
  }
  const delivery = await dispatchOperationalAlerts(config, now)
  return { issues, ...delivery, failed: delivery.retry + delivery.review }
}

export async function handleOperationalMaintenance(req, res, config) {
  const reply = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(value)) }
  if (req.method !== 'GET') return reply(405, { error: 'Method not allowed' })
  if (!config?.cronSecret || req.headers.authorization !== `Bearer ${config.cronSecret}`) return reply(401, { error: 'Unauthorized' })
  try { return reply(200, await checkOperationalRuns(config)) }
  catch { return reply(503, { error: 'Operational monitoring could not finish.' }) }
}
