import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createAcademyServer } from './server.mjs'

test('construction gate protects all files and API before database access', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aca-test-'))
  await writeFile(join(root, 'index.html'), '<h1>Academy</h1>')
  let calls = 0
  const server = createAcademyServer({ password: 'test-only-long-construction-password', root, courseId: 'test-course', db: { from() { calls++; throw new Error('offline') } } })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const headers = { Authorization: 'Basic ' + Buffer.from('academy:test-only-long-construction-password').toString('base64') }
  try {
    for (const path of ['/', '/academy/phase-one/', '/assets/site.css', '/api/academy/phase-one']) {
      const response = await fetch(base + path)
      assert.equal(response.status, 401)
      assert.match(response.headers.get('cache-control'), /no-store/)
    }
    assert.equal(calls, 0)
    assert.equal((await fetch(base, { headers })).status, 200)
    assert.equal((await fetch(base + '/api/academy/phase-one', { headers, method: 'POST' })).status, 405)
    assert.equal(calls, 0)
    assert.equal((await fetch(base + '/server.mjs', { headers })).status, 404)
    const failure = await fetch(base + '/api/academy/phase-one', { headers })
    assert.equal(failure.status, 503)
    assert.doesNotMatch(await failure.text(), /offline/)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true }) }
})
test('construction gate refuses missing or short passwords', () => {
  assert.throws(() => createAcademyServer({ password: 'short' }), /24 characters/)
})
