import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

test('the configured production entrypoint starts in workerd and stays inert while disabled', async () => {
  const config = JSON.parse(await readFile(new URL('./incident-timer.wrangler.json', import.meta.url)))
  const entry = fileURLToPath(new URL(config.main, import.meta.url))
  const core = fileURLToPath(new URL('./incident-timer.mjs', import.meta.url))
  let requests = 0
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: config.name, host: '127.0.0.1', cf: false,
    compatibilityDate: config.compatibility_date,
    modules: [{ type: 'ESModule', path: entry }, { type: 'ESModule', path: core }],
    bindings: config.vars,
    outboundService: async () => { requests++; throw new Error('Disabled timer attempted network access') },
  }))
  try {
    const worker = await mf.getWorker()
    const scheduled = await worker.scheduled({ cron: config.triggers.crons[0], scheduledTime: Date.now() })
    assert.equal(scheduled.outcome, 'ok')
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
    modules: [{ type: 'ESModule', path: entry }, { type: 'ESModule', path: core }],
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
