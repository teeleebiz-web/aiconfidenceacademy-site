import test from 'node:test'
import assert from 'node:assert/strict'
import worker from './incident-timer.mjs'
import { backupTick, backupCron } from './backup-timer.mjs'
const time = Date.parse('2026-11-08T18:17:23.400Z')
const event = { cron: backupCron, scheduledTime: time }
const env = { ACA_BACKUP_TIMER_ENABLED: 'true', ACA_TIMER_GITHUB_TOKEN: 'fixture-token' }
const base = 'https://api.github.com/repos/teeleebiz-web/aiconfidenceacademy-site/actions/workflows/automatic-storage-backup.yml'
const options = overrides => ({ now: () => time + 1000, log: () => {}, ...overrides })
const ready = () => Response.json({ workflow_runs: [] })

test('daily timer selects only the fixed backup workflow on main and sanitizes logs', async () => {
  const calls = [], logs = []
  const r = await backupTick(event, { ...env, URL: 'https://evil.example', ref: 'other' }, options({
    request: async (url, init) => { calls.push({ url, init }); return calls.length === 1 ? ready() : Response.json({ workflow_run_id: 4, secret: 'fixture-token' }) },
    log: v => logs.push(v),
  }))
  assert.deepEqual(calls.map(c => c.url), [`${base}/runs?branch=main&per_page=20`, `${base}/dispatches`])
  assert.deepEqual(JSON.parse(calls[1].init.body), { ref: 'main' })
  assert.ok(calls.every(c => c.init.redirect === 'manual' && c.init.signal instanceof AbortSignal))
  assert.equal(r.status, 'accepted'); assert.equal(r.workflow_run_id, '4')
  assert.doesNotMatch(logs.join(''), /fixture-token|secret|evil/)
})
test('backup activation is independent and disabled schedules cannot touch GitHub', async () => {
  for (const value of [undefined, 'false', true, 'TRUE']) {
    assert.deepEqual(await backupTick(event, { ...env, ACA_TIMER_ENABLED: 'true', ACA_BACKUP_TIMER_ENABLED: value }, options({ request: () => assert.fail('network') })), { status: 'held' })
  }
  assert.deepEqual(await worker.scheduled(event, {}), { status: 'held' })
})
test('native active or already completed daily run suppresses another dispatch', async () => {
  for (const [status, created_at] of [['queued', '2026-11-07T18:17:00Z'], ['in_progress', '2026-11-08T18:17:00Z'], ['completed', '2026-11-08T18:17:00Z']]) {
    let count = 0
    const r = await backupTick(event, env, options({ request: async () => { assert.equal(++count, 1); return Response.json({ workflow_runs: [{ id: 2, head_branch: 'main', status, created_at }] }) } }))
    assert.equal(r.status, 'already-started')
  }
})
test('wrong schedule, time, branch, malformed evidence and credential fail before dispatch', async () => {
  for (const controller of [null, { ...event, cron: '*/15 * * * *' }, { ...event, scheduledTime: time - 60000 }]) {
    await assert.rejects(backupTick(controller, env, options({ request: () => assert.fail('network') })), /needs review/)
  }
  for (const now of [time - 1, time + 600001]) await assert.rejects(backupTick(event, env, options({ now: () => now, request: () => assert.fail('network') })), /needs review/)
  for (const token of ['', undefined, 'x\ny']) await assert.rejects(backupTick(event, { ...env, ACA_TIMER_GITHUB_TOKEN: token }, options({ request: () => assert.fail('network') })), /needs review/)
  for (const response of [new Response('', { status: 302 }), new Response('', { status: 403 }), Response.json({}), Response.json({ workflow_runs: [{ id: 2, head_branch: 'other' }] })]) {
    let count = 0
    await assert.rejects(backupTick(event, env, options({ request: async () => { assert.equal(++count, 1); return response } })), /needs review/)
  }
})
test('uncertain dispatch is never retried, and accepted is not a verified backup', async () => {
  let count = 0
  await assert.rejects(backupTick(event, env, options({ request: async () => {
    if (++count === 1) return ready()
    throw Error('fixture-token private error')
  } })), e => /needs review/.test(e.message) && !/fixture-token/.test(e.message))
  assert.equal(count, 2)
  count = 0
  const r = await backupTick(event, env, options({ request: async () => ++count === 1 ? ready() : new Response(null, { status: 204 }) }))
  assert.equal(r.status, 'accepted'); assert.equal(r.workflow_run_id, null)
})
