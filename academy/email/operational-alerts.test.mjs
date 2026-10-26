import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { queueOperationalAlert, dispatchOperationalAlerts, checkOperationalRuns, handleOperationalMaintenance, scheduledSlot } from './operational-alerts.mjs'
import { recordAutomationRun } from '../enrollment/control-center.mjs'
import { createAcademyServer } from '../server.mjs'
import { once } from 'node:events'
import { tmpdir } from 'node:os'

function fixture() {
  let now = new Date('2026-10-17T21:00:00Z'), reject = false, uncertain = false, failMark = false
  const tables = { aca_backup_automation: [{ id: true, enabled: false }], aca_operational_monitor: [{ id: true, activated_at: '2026-10-17T08:00:00Z' }], aca_operational_alerts: [], aca_automation_runs: [], aca_email_events: [] }, sends = [], accepted = new Map()
  const db = {
    async rpc(name) {
      if (name === 'aca_support_alert_recipients') return { data: [{ email: 'owner@example.test' }] }
      assert.equal(name, 'aca_claim_operational_alerts')
      const rows = tables.aca_operational_alerts.filter(a => a.status === 'queued' && Date.parse(a.next_attempt_at) <= +now || a.status === 'sending' && Date.parse(a.claim_expires_at) < +now).slice(0, 5)
      for (const a of rows) Object.assign(a, { status: 'sending', attempts: a.attempts + 1, first_attempt_at: a.first_attempt_at || now.toISOString(), claim_token: randomUUID(), claim_expires_at: new Date(+now + 300000).toISOString() })
      return { data: structuredClone(rows) }
    },
    from(table) {
      assert.ok(tables[table], table)
      const filters = []; let write, count = Infinity, order, head = false
      const execute = () => {
        let rows = tables[table].filter(r => filters.every(f => f(r)))
        if (order) rows.sort((a, b) => String(b[order]).localeCompare(String(a[order])))
        rows = rows.slice(0, count)
        if (write?.kind === 'insert' || write?.kind === 'upsert') {
          let old = write.kind === 'upsert' ? tables[table].find(r => r.event_key === write.value.event_key) : null
          if (!old) {
            old = { id: randomUUID(), attempts: 0, created_at: now.toISOString(), status: table === 'aca_automation_runs' ? 'running' : 'queued', next_attempt_at: now.toISOString(), ...write.value }
            tables[table].push(old)
          } else if (!write.ignore) Object.assign(old, write.value)
          rows = [old]
        } else if (write) {
          if (failMark && table === 'aca_email_events' && write.value.status === 'sent') { failMark = false; return { error: Error('private database error') } }
          for (const row of rows) Object.assign(row, write.value)
        }
        return { data: head ? null : structuredClone(rows), count: rows.length }
      }
      const q = {
        select(_, options) { head = options?.head || false; return q }, eq(k, v) { filters.push(r => r[k] === v); return q },
        gte(k, v) { filters.push(r => r[k] >= v); return q }, lte(k, v) { filters.push(r => r[k] <= v); return q },
        order(k) { order = k; return q }, limit(v) { count = v; return q },
        insert(value) { write = { kind: 'insert', value }; return q },
        upsert(value, opts) { write = { kind: 'upsert', value, ignore: opts?.ignoreDuplicates }; return q },
        update(value) { write = { kind: 'update', value }; return q },
        async single() { const r = execute(); return r.error ? r : { data: r.data[0], error: r.data.length === 1 ? null : Error('Expected one row') } },
        async maybeSingle() { const r = execute(); return r.error ? r : { data: r.data[0] || null } },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject) },
      }
      return q
    },
  }
  const config = { db, cronSecret: 'secret', emailFrom: 'ACA <notifications@example.test>', appUrl: 'https://aiconfidenceacademy.org', resend: { emails: { async send(message, opts) {
    sends.push({ message, opts })
    if (reject) return { error: { message: 'private provider error' } }
    if (!accepted.has(opts.idempotencyKey)) accepted.set(opts.idempotencyKey, { data: { id: randomUUID() } })
    if (uncertain) throw Error('private transport error')
    return accepted.get(opts.idempotencyKey)
  } } } }
  return { config, tables, sends, accepted, get now() { return now }, set now(v) { now = new Date(v) }, set reject(v) { reject = v }, set uncertain(v) { uncertain = v }, set failMark(v) { failMark = v } }
}
const issue = { job: 'installment-maintenance', reason: 'job_failed', occurredAt: '2026-10-17T09:05:00Z' }
const response = () => ({ writeHead(status, headers) { this.status = status; this.headers = headers }, end(v) { this.body = JSON.parse(v) } })
const cron = { method: 'GET', headers: { authorization: 'Bearer secret' } }

test('trusted-owner alerts coalesce by daily task, reason and recipient; email contains no raw failure or learner data', async () => {
  const c = fixture()
  await queueOperationalAlert(c.config, { ...issue, learnerEmail: 'private@example.test', error: 'sk_live_secret' })
  await queueOperationalAlert(c.config, { ...issue, occurredAt: '2026-10-17T09:45:00Z' })
  assert.equal(c.tables.aca_operational_alerts.length, 1)
  assert.deepEqual(await dispatchOperationalAlerts(c.config, c.now), { submitted: 1, retry: 0, review: 0 })
  assert.equal(c.sends[0].message.to, 'owner@example.test')
  assert.match(c.sends[0].message.html, /https:\/\/aiconfidenceacademy.org\/control-center\//)
  assert.doesNotMatch(JSON.stringify(c.sends), /private@example|sk_live|password|learn\//)
  await dispatchOperationalAlerts(c.config, c.now)
  assert.equal(c.sends.length, 1)
})
test('two competing dispatchers claim and submit an alert only once', async () => {
  const c = fixture(); await queueOperationalAlert(c.config, issue)
  await Promise.all([dispatchOperationalAlerts(c.config, c.now), dispatchOperationalAlerts(c.config, c.now)])
  assert.equal(c.sends.length, 1)
  assert.equal(c.tables.aca_operational_alerts[0].status, 'sent')
})
test('a definite rejection is retried with the same provider key and then stops after three failed attempts', async () => {
  const c = fixture(); await queueOperationalAlert(c.config, issue); c.reject = true
  for (let i = 0; i < 3; i++) { await dispatchOperationalAlerts(c.config, c.now); c.now = +c.now + 16 * 60000 }
  assert.equal(c.tables.aca_operational_alerts[0].status, 'review')
  assert.equal(c.sends.length, 3)
  assert.equal(new Set(c.sends.map(s => s.opts.idempotencyKey)).size, 1)
  await dispatchOperationalAlerts(c.config, c.now); assert.equal(c.sends.length, 3)
  assert.equal((await dispatchOperationalAlerts(c.config, c.now)).review, 1, 'An outstanding review remains visible on later monitor runs')
})
test('an interrupted email marker retries one unchanged message within provider dedupe retention', async () => {
  const c = fixture(); await queueOperationalAlert(c.config, issue); c.failMark = true
  assert.equal((await dispatchOperationalAlerts(c.config, c.now)).retry, 1)
  c.now = +c.now + 16 * 60000
  assert.equal((await dispatchOperationalAlerts(c.config, c.now)).submitted, 1)
  assert.equal(c.accepted.size, 1)
  assert.deepEqual(c.sends[0], c.sends[1])
})
test('uncertain provider submissions older than 23 hours are held for review without another send', async () => {
  const c = fixture(); await queueOperationalAlert(c.config, issue); c.uncertain = true
  await dispatchOperationalAlerts(c.config, c.now); c.uncertain = false; c.now = +c.now + 24 * 3600000
  assert.equal((await dispatchOperationalAlerts(c.config, c.now)).review, 1)
  assert.equal(c.sends.length, 1)
})
test('a later rejection cannot make an earlier lost response safe to resend after key expiry', async () => {
  const c = fixture(); await queueOperationalAlert(c.config, issue); c.uncertain = true
  await dispatchOperationalAlerts(c.config, c.now)
  c.uncertain = false; c.reject = true; c.now = +c.now + 16 * 60000
  await dispatchOperationalAlerts(c.config, c.now)
  assert.equal(c.tables.aca_email_events[0].status, 'failed')
  c.reject = false; c.now = +c.now + 24 * 3600000
  assert.equal((await dispatchOperationalAlerts(c.config, c.now)).review, 1)
  assert.equal(c.sends.length, 2)
})
test('a malformed provider success is uncertain and a removed owner never receives a queued alert', async () => {
  const c = fixture(); await queueOperationalAlert(c.config, issue)
  c.config.resend.emails.send = async () => ({ data: {} })
  assert.equal((await dispatchOperationalAlerts(c.config, c.now)).retry, 1)
  assert.equal(c.tables.aca_email_events[0].status, 'sending')
  c.now = +c.now + 16 * 60000
  c.tables.aca_operational_alerts[0].recipient = 'former-owner@example.test'
  assert.equal((await dispatchOperationalAlerts(c.config, c.now)).review, 1)
  assert.equal(c.tables.aca_operational_alerts[0].last_error, 'Recipient is no longer an authorized owner.')
})
test('a crashed sender lease recovers existing submission without sending again; bounced alerts are not resent', async () => {
  for (const status of ['sent', 'delivered', 'bounced', 'complained', 'suppressed', 'failed']) {
    const c = fixture(); await queueOperationalAlert(c.config, issue)
    const a = c.tables.aca_operational_alerts[0]
    Object.assign(a, { status: 'sending', claim_expires_at: '2026-10-17T20:00:00Z', first_attempt_at: '2026-10-17T19:00:00Z' })
    c.tables.aca_email_events.push({ event_key: `operations-alert:${a.id}`, status, provider_message_id: 'already-submitted' })
    await dispatchOperationalAlerts(c.config, c.now)
    assert.equal(c.sends.length, 0)
    assert.equal(a.status, ['sent', 'delivered'].includes(status) ? 'sent' : 'review')
  }
})
test('daily check detects missing and stalled runs and recorded failures without rerunning tasks', async () => {
  const c = fixture()
  c.tables.aca_automation_runs.push({ id: randomUUID(), job: 'lesson-releases', started_at: '2026-10-17T16:10:00Z', status: 'running' }, { id: randomUUID(), job: 'newsletter-maintenance', started_at: '2026-10-17T18:15:00Z', status: 'warning', finished_at: '2026-10-17T18:15:05Z' })
  const result = await checkOperationalRuns(c.config, c.now)
  assert.equal(result.issues, 3)
  assert.deepEqual(c.tables.aca_operational_alerts.map(a => a.reason), ['run_missing', 'run_stalled', 'job_warning'])
  assert.equal(c.sends.length, 3)
  await checkOperationalRuns(c.config, c.now); assert.equal(c.sends.length, 3)
})
test('activation baseline and two-hour allowance prevent historical or early missing-run alerts', async () => {
  const c = fixture(); c.now = '2026-10-17T10:59:00Z'
  assert.equal((await checkOperationalRuns(c.config, c.now)).issues, 0)
  assert.equal(c.sends.length, 0)
  assert.equal(scheduledSlot('installment-maintenance', c.now, 7200000), '2026-10-16T09:00:00.000Z')
  c.now = '2026-10-17T11:00:00Z'
  assert.equal((await checkOperationalRuns(c.config, c.now)).issues, 1)
})
test('successful tasks and deliberately disabled newsletter holds produce no incident', async () => {
  const c = fixture()
  for (const [job, hour] of [['installment-maintenance', '09'], ['lesson-releases', '16'], ['newsletter-maintenance', '18']]) c.tables.aca_automation_runs.push({ id: randomUUID(), job, status: 'completed', started_at: `2026-10-17T${hour}:00:00Z`, finished_at: `2026-10-17T${hour}:00:05Z` })
  assert.equal((await checkOperationalRuns(c.config, c.now)).issues, 0)
  assert.equal(c.sends.length, 0)
})

test('disabled backup policy produces no false missing-run or credential alerts', async () => {
  const c = fixture()
  c.tables.aca_backup_automation[0].credential_expires_at = '2026-10-17T00:00:00Z'
  await checkOperationalRuns(c.config, c.now)
  assert.ok(c.tables.aca_operational_alerts.every(a => a.job !== 'storage-backups'))
})

test('backup monitor uses its activation date, exact minute, two-hour allowance and owner recipient', async () => {
  const c = fixture()
  Object.assign(c.tables.aca_backup_automation[0], { enabled: true, activated_at: '2026-10-17T10:00:00Z' })
  c.now = '2026-10-17T20:16:59Z'
  await checkOperationalRuns(c.config, c.now)
  assert.ok(c.tables.aca_operational_alerts.every(a => a.job !== 'storage-backups'))
  c.now = '2026-10-17T20:17:00Z'
  await checkOperationalRuns(c.config, c.now)
  const alert = c.tables.aca_operational_alerts.find(a => a.job === 'storage-backups')
  assert.equal(alert.reason, 'run_missing')
  assert.equal(alert.occurred_at, '2026-10-17T18:17:00.000Z')
  assert.equal(alert.recipient, 'owner@example.test')
})

test('backup failure, interruption and approaching expiration are independent incidents', async () => {
  const c = fixture()
  Object.assign(c.tables.aca_backup_automation[0], { enabled: true, activated_at: '2026-10-17T10:00:00Z', credential_expires_at: '2026-10-20T21:00:00Z' })
  c.tables.aca_automation_runs.push({ id: randomUUID(), job: 'storage-backups', status: 'failed', started_at: '2026-10-17T18:17:00Z', finished_at: '2026-10-17T18:20:00Z' })
  c.tables.aca_automation_runs.push({ id: randomUUID(), job: 'storage-backups', status: 'running', started_at: '2026-10-17T20:14:00Z' })
  await checkOperationalRuns(c.config, c.now)
  assert.deepEqual(c.tables.aca_operational_alerts.filter(a => a.job === 'storage-backups').map(a => a.reason).sort(), ['credential_expiring', 'job_failed', 'run_stalled'])
  assert.ok(c.sends.every(s => s.message.to === 'owner@example.test'))
})

test('a running backup gets forty-five minutes without changing other task windows', async () => {
  const c = fixture()
  Object.assign(c.tables.aca_backup_automation[0], { enabled: true, activated_at: '2026-10-17T10:00:00Z' })
  c.tables.aca_automation_runs.push({ id: randomUUID(), job: 'storage-backups', status: 'running', started_at: '2026-10-17T20:30:00Z' })
  await checkOperationalRuns(c.config, c.now)
  assert.ok(c.tables.aca_operational_alerts.every(a => a.job !== 'storage-backups'))
})
test('unauthorized monitoring probes and wrong methods cannot read or send anything', async () => {
  for (const req of [{ method: 'GET', headers: {} }, { method: 'POST', headers: cron.headers }]) {
    const res = response()
    await handleOperationalMaintenance(req, res, { cronSecret: 'secret', db: { from() { throw Error('must not read') } } })
    assert.ok([401, 405].includes(res.status))
  }
})
test('real wrapper preserves failure response, alerts the owner and records submission separately', async () => {
  const c = fixture(), res = response()
  await recordAutomationRun(cron, res, c.config, 'installment-maintenance', async (_, r) => { r.writeHead(500); r.end(JSON.stringify({ error: 'private learner failure' })) })
  assert.equal(res.status, 500); assert.equal(res.body.error, 'private learner failure')
  assert.equal(c.tables.aca_automation_runs[0].status, 'failed')
  assert.equal(c.tables.aca_automation_runs[0].result.operational_alerts.submitted, 1)
  assert.doesNotMatch(JSON.stringify(c.sends), /private learner failure/)
})
test('alert outages preserve successful job work while leaving a warning and retryable notification', async () => {
  const c = fixture(), res = response(); c.reject = true
  await queueOperationalAlert(c.config, issue)
  let performed = 0
  await recordAutomationRun(cron, res, c.config, 'installment-maintenance', async (_, r) => { performed++; r.writeHead(200); r.end(JSON.stringify({ processed: 1 })) })
  assert.equal(performed, 1); assert.equal(res.status, 200); assert.deepEqual(res.body, { processed: 1 })
  assert.equal(c.tables.aca_automation_runs[0].status, 'warning')
  assert.equal(c.tables.aca_automation_runs[0].result.operational_alerts.retry, 1)
  assert.equal(c.tables.aca_operational_alerts[0].status, 'queued')
})
test('history write failure still alerts without rerunning the task', async () => {
  const c = fixture(), original = c.config.db.from.bind(c.config.db), res = response()
  c.config.db.from = table => table === 'aca_automation_runs' ? { insert() { return this }, select() { return this }, single: async () => ({ error: Error('history offline') }) } : original(table)
  await recordAutomationRun(cron, res, c.config, 'installment-maintenance', async (_, r) => { r.writeHead(200); r.end(JSON.stringify({ processed: 1 })) })
  assert.equal(res.status, 200); assert.equal(c.sends.length, 1)
  assert.equal(c.tables.aca_operational_alerts[0].reason, 'history_failed')
})
test('production server routes monitoring through cron authorization without the curriculum construction gate', async () => {
  const server = createAcademyServer({ password: 'test-only-long-construction-password', root: tmpdir(), db: { from() { throw Error('must not read') } }, courseId: 'unused', enrollmentAutomation: { cronSecret: 'secret' } })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}/api/operations/maintenance`
  try {
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await fetch(url, { method: 'POST' })).status, 405)
    assert.equal((await fetch(url, { headers: { Origin: 'https://attacker.example' } })).status, 403)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
