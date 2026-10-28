import test from 'node:test'
import assert from 'node:assert/strict'
import worker, { tick, timerCron } from './incident-timer.mjs'

const time = Date.parse('2026-10-27T15:00:00Z')
const event = { cron: timerCron, scheduledTime: time }
const env = { ACA_TIMER_ENABLED: 'true', ACA_TIMER_GITHUB_TOKEN: 'fixture-token' }
const base = 'https://api.github.com/repos/teeleebiz-web/aiconfidenceacademy-site/actions/workflows/incident-diagnostics.yml'
const ready = () => Response.json({ workflow_runs: [] })
const options = overrides => ({ now: () => time + 1000, log: () => {}, ...overrides })

test('timer dispatches only the fixed collector, main ref and collect mode; logs only finite evidence', async () => {
  const calls = [], logs = []
  const result = await tick(event, { ...env, URL: 'https://evil.example', ref: 'other', mode: 'repair' }, options({
    request: async (url, init) => {
      calls.push({ url, init })
      return calls.length === 1 ? ready() : Response.json({ workflow_run_id: 123, html_url: 'ignored', secret: 'untrusted' })
    }, log: value => logs.push(value),
  }))
  assert.deepEqual(calls.map(c => [c.url, c.init.method]), [[`${base}/runs?branch=main&per_page=20`, 'GET'], [`${base}/dispatches`, 'POST']])
  assert.deepEqual(JSON.parse(calls[1].init.body), { ref: 'main', inputs: { mode: 'collect' } })
  for (const { init } of calls) {
    assert.equal(init.redirect, 'manual')
    assert.equal(init.headers.Authorization, 'Bearer fixture-token')
    assert.equal(init.headers['X-GitHub-Api-Version'], '2026-03-10')
    assert.ok(init.signal instanceof AbortSignal)
  }
  assert.deepEqual(result, { scheduled_at: '2026-10-27T15:00:00.000Z', status: 'accepted', workflow_run_id: '123' })
  assert.deepEqual(logs, [JSON.stringify(result)])
  assert.doesNotMatch(logs.join(''), /fixture-token|untrusted|ignored/)
})

test('disabled or missing activation cannot touch GitHub', async () => {
  for (const value of [undefined, 'false', true, 'TRUE']) {
    assert.deepEqual(await tick(event, { ...env, ACA_TIMER_ENABLED: value }, options({ request: () => assert.fail('network') })), { status: 'held' })
  }
})

test('a fresh Cloudflare timestamp with seconds and milliseconds dispatches normally', async () => {
  const scheduledTime = Date.parse('2026-10-28T06:45:53.640Z')
  let count = 0
  const result = await tick({ cron: timerCron, scheduledTime }, env, options({
    now: () => scheduledTime + 1040,
    request: async () => ++count === 1 ? ready() : Response.json({ workflow_run_id: 456 }),
  }))
  assert.equal(count, 2)
  assert.deepEqual(result, { scheduled_at: '2026-10-28T06:45:53.640Z', status: 'accepted', workflow_run_id: '456' })
})

test('invalid schedule, stale/future event and missing or malformed token fail closed', async () => {
  for (const controller of [{ ...event, cron: '* * * * *' }, { ...event, scheduledTime: time + 0.5 }, { ...event, scheduledTime: 'time' }, { ...event, scheduledTime: NaN }, { ...event, scheduledTime: Infinity }, null]) {
    await assert.rejects(tick(controller, env, options({ request: () => assert.fail('network') })), /needs review/)
  }
  for (const now of [time - 1, time + 600001]) await assert.rejects(tick(event, env, options({ now: () => now, request: () => assert.fail('network') })), /needs review/)
  for (const token of [undefined, '', ' ', 'value\nvalue']) await assert.rejects(tick(event, { ...env, ACA_TIMER_GITHUB_TOKEN: token }, options({ request: () => assert.fail('network') })), /needs review/)
})

test('active collector suppresses another dispatch', async () => {
  for (const status of ['queued', 'in_progress', 'waiting', 'requested', 'pending']) {
    let count = 0
    const result = await tick(event, env, options({ request: async () => {
      assert.equal(++count, 1)
      return Response.json({ workflow_runs: [{ id: 123, head_branch: 'main', status, created_at: '2026-10-27T14:59:00Z' }] })
    } }))
    assert.equal(result.status, 'busy')
    assert.equal(result.workflow_run_id, '123')
  }
})

test('network, credentials, rate-limit, redirects and malformed run evidence never dispatch or retry', async () => {
  for (const response of [new Response('', { status: 401 }), new Response('', { status: 403 }), new Response('', { status: 429 }), new Response('', { status: 302 }), Response.json({}), Response.json({ workflow_runs: [{ id: 1, head_branch: 'other' }] }), new Response('not JSON')]) {
    let count = 0
    await assert.rejects(tick(event, env, options({ request: async () => { assert.equal(++count, 1); return response } })), /needs review/)
  }
  await assert.rejects(tick(event, env, options({ request: async () => { throw new Error('fixture-token secret provider text') } })), error => !/fixture-token|provider text/.test(error.message))
})

test('uncertain dispatch is attempted once and does not leak the provider response', async () => {
  for (const response of [null, new Response('', { status: 500 }), Response.json({ secret: 'fixture-token' }), new Response('fixture-token')]) {
    let count = 0
    await assert.rejects(tick(event, env, options({ request: async () => {
      if (++count === 1) return ready()
      assert.equal(count, 2)
      if (!response) throw new Error('fixture-token')
      return response
    } })), error => /needs review/.test(error.message) && !/fixture-token/.test(error.message))
    assert.equal(count, 2)
  }
})

test('legacy empty acceptance remains distinct from collector success', async () => {
  let count = 0
  const result = await tick(event, env, options({ request: async () => ++count === 1 ? ready() : new Response(null, { status: 204 }) }))
  assert.equal(result.status, 'accepted')
  assert.equal(result.workflow_run_id, null)
})

test('all public HTTP requests return 404 without using any secret or dispatch', async () => {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const result = await worker.fetch(new Request('https://timer.example/?mode=collect', { method }), env)
    assert.equal(result.status, 404)
  }
})
