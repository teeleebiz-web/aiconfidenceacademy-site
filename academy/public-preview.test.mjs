import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { servePublicPreview } from './public-preview.mjs'

async function request(root, route, method = 'GET') {
  const result = { status: null, headers: {}, body: null }
  const response = {
    setHeader(name, value) { result.headers[name] = value },
    writeHead(status, headers = {}) { result.status = status; Object.assign(result.headers, headers) },
    end(body) { result.body = body?.toString() ?? null },
  }
  await servePublicPreview({ method }, response, route, root)
  return result
}

test('review preview serves public pages but refuses learner and API paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aca-review-'))
  try {
    await mkdir(join(root, 'explore'), { recursive: true })
    await mkdir(join(root, 'assets'), { recursive: true })
    await mkdir(join(root, 'academy'), { recursive: true })
    await writeFile(join(root, 'explore/index.html'), '<h1>Explore ACA</h1>')
    await writeFile(join(root, 'assets/explore.css'), 'body { color: navy }')
    await writeFile(join(root, 'academy/secret.html'), 'protected')
    assert.match((await request(root, 'explore/')).body, /Explore ACA/)
    assert.equal((await request(root, 'explore')).status, 200)
    assert.equal((await request(root, 'assets/explore.css')).status, 200)
    assert.equal((await request(root, 'explore/', 'HEAD')).body, null)
    for (const path of ['academy/secret.html', 'learn/', 'api/academy/phase-one', 'assets/../academy/secret.html']) {
      assert.equal((await request(root, path)).status, 404, path)
    }
    assert.equal((await request(root, 'explore/', 'POST')).status, 405)
  } finally { await rm(root, { recursive: true, force: true }) }
})
