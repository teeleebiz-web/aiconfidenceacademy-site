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
    await worker.scheduled({ cron: config.triggers.crons[0], scheduledTime: Date.now() })
    const response = await mf.dispatchFetch('https://timer.invalid/?mode=collect', { method: 'POST' })
    assert.equal(response.status, 404)
    assert.equal(requests, 0)
  } finally { await mf.dispose() }
})
