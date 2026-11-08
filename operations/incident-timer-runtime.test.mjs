import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

test('daily backup handler runs in workerd against fixture GitHub, with no live credentials', async () => {
  const config = JSON.parse(await readFile(new URL('./incident-timer.wrangler.json', import.meta.url)))
  const entry = fileURLToPath(new URL(config.main, import.meta.url))
  const time = Date.parse('2026-11-08T18:17:23.400Z'), calls = []
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: config.name, host: '127.0.0.1', cf: false, compatibilityDate: config.compatibility_date,
    modules: [
      { type: 'ESModule', path: fileURLToPath(new URL('./timer-clock-fixture.mjs', import.meta.url)),
        contents: `import worker from './incident-timer-worker.mjs'; export default {async scheduled(event,env,ctx) {Date.now=()=>${time + 1000};return worker.scheduled(event,env,ctx)}}` },
      ...[entry, ...['incident-timer.mjs','backup-timer.mjs'].map(p => fileURLToPath(new URL(p, import.meta.url)))].map(path => ({ type: 'ESModule', path })),
    ],
    bindings: { ACA_TIMER_ENABLED: 'true', ACA_BACKUP_TIMER_ENABLED: 'true', ACA_TIMER_GITHUB_TOKEN: 'fixture-not-live' },
    outboundService: async request => {
      calls.push({ url: request.url, method: request.method, body: await request.text() })
      return Response.json(calls.length === 1 ? { workflow_runs: [] } : { workflow_run_id: 789 })
    },
  }))
  try {
    const worker = await mf.getWorker()
    const result = await worker.scheduled({ cron: '17 18 * * *', scheduledTime: time })
    assert.equal(result.outcome, 'ok')
    const base = 'https://api.github.com/repos/teeleebiz-web/aiconfidenceacademy-site/actions/workflows/automatic-storage-backup.yml'
    assert.deepEqual(calls, [
      { url: `${base}/runs?branch=main&per_page=20`, method: 'GET', body: '' },
      { url: `${base}/dispatches`, method: 'POST', body: JSON.stringify({ ref: 'main' }) },
    ])
  } finally { await mf.dispose() }
})

test('the configured production entrypoint starts in workerd and stays inert while disabled', async () => {
  const config = JSON.parse(await readFile(new URL('./incident-timer.wrangler.json', import.meta.url)))
  const entry = fileURLToPath(new URL(config.main, import.meta.url))
  const core = fileURLToPath(new URL('./incident-timer.mjs', import.meta.url))
  let requests = 0
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: config.name, host: '127.0.0.1', cf: false,
    compatibilityDate: config.compatibility_date,
    modules: [{ type: 'ESModule', path: entry }, { type: 'ESModule', path: core }, { type: 'ESModule', path: fileURLToPath(new URL('./backup-timer.mjs', import.meta.url)) }],
    bindings: config.vars,
    outboundService: async () => { requests++; throw new Error('Disabled timer attempted network access') },
  }))
  try {
    const worker = await mf.getWorker()
    for (const cron of config.triggers.crons) {
      const scheduled = await worker.scheduled({ cron, scheduledTime: Date.now() })
      assert.equal(scheduled.outcome, 'ok')
    }
    const response = await mf.dispatchFetch('https://timer.invalid/?mode=collect', { method: 'POST' })
    assert.equal(response.status, 404)
    assert.equal(requests, 0)
  } finally { await mf.dispose() }
})

test('the configured production entrypoint accepts a fresh non-rounded timestamp in workerd', async () => {
  const config = JSON.parse(await readFile(new URL('./incident-timer.wrangler.json', import.meta.url)))
  const entry = fileURLToPath(new URL(config.main, import.meta.url))
  const core = fileURLToPath(new URL('./incident-timer.mjs', import.meta.url))
  const calls = []
  const runtimeLogs = []
  let redirect = false
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: config.name, host: '127.0.0.1', cf: false,
    compatibilityDate: config.compatibility_date,
    modules: [{ type: 'ESModule', path: entry }, { type: 'ESModule', path: core }, { type: 'ESModule', path: fileURLToPath(new URL('./backup-timer.mjs', import.meta.url)) }],
    bindings: { ACA_TIMER_ENABLED: 'true', ACA_TIMER_GITHUB_TOKEN: 'fixture-not-live' },
    handleStructuredLogs: entry => runtimeLogs.push(entry),
    outboundService: async request => {
      calls.push({ url: request.url, method: request.method, body: await request.text() })
      if (redirect) return new Response(null, { status: 302, headers: { Location: 'https://outside.invalid/' } })
      return Response.json(calls.length === 1 ? { workflow_runs: [] } : { workflow_run_id: 456 })
    },
  }))
  try {
    const worker = await mf.getWorker()
    const scheduledTime = Date.now() - 1040
    const scheduled = await worker.scheduled({ cron: config.triggers.crons[0], scheduledTime })
    assert.equal(scheduled.outcome, 'ok', JSON.stringify({ scheduled, calls, runtimeLogs }))
    const base = 'https://api.github.com/repos/teeleebiz-web/aiconfidenceacademy-site/actions/workflows/incident-diagnostics.yml'
    assert.deepEqual(calls, [
      { url: `${base}/runs?branch=main&per_page=20`, method: 'GET', body: '' },
      { url: `${base}/dispatches`, method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { mode: 'collect' } }) },
    ])
    redirect = true
    const rejected = await worker.scheduled({ cron: config.triggers.crons[0], scheduledTime: Date.now() - 1040 })
    assert.equal(rejected.outcome, 'exception')
    assert.equal(calls.length, 3)
    assert.equal(calls[2].url, `${base}/runs?branch=main&per_page=20`)
  } finally { await mf.dispose() }
})
