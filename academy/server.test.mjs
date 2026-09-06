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
    for (const path of ['/', '/academy/phase-one/', '/assets/site.css', '/api/academy/phase-one', '/api/academy/lesson-audio/test']) {
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

test('lesson audio signs only a saved path for a lesson in the configured course', async () => {
  const signedPaths = []
  const db = {
    from(table) {
      const query = {
        select() { return query },
        eq(key, value) { assert.equal(value, 'test-course'); return query },
        neq() { return query },
        single() { return Promise.resolve({ data: { id: 'test-course' } }) },
        order() { return Promise.resolve({ data: table === 'lessons' ? [{ id: 'allowed', content: { audio_path: 'lesson.mp3' } }, { id: 'no-audio', content: {} }] : [] }) },
      }
      return query
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'aca-learning-media')
      return { async createSignedUrl(path) { signedPaths.push(path); return { data: { signedUrl: 'https://example.com/signed-audio' } } } }
    } },
  }
  const server = createAcademyServer({ password: 'test-only-long-construction-password', root: tmpdir(), courseId: 'test-course', db })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api/academy/lesson-audio/`
  const headers = { Authorization: 'Basic ' + Buffer.from('academy:test-only-long-construction-password').toString('base64') }
  try {
    for (const id of ['unknown', 'no-audio']) assert.equal((await fetch(base + id, { headers })).status, 404)
    assert.deepEqual(signedPaths, [])
    const response = await fetch(base + 'allowed?path=other.mp3', { headers, redirect: 'manual' })
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('location'), 'https://example.com/signed-audio')
    assert.deepEqual(signedPaths, ['lesson.mp3'])
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})

test('walkthrough video supports protected byte ranges and captions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aca-media-'))
  const video = Buffer.alloc(2 * 1024 * 1024, 7)
  await writeFile(join(root, 'walkthrough.mp4'), video)
  await writeFile(join(root, 'captions.vtt'), 'WEBVTT\n\n')
  const server = createAcademyServer({ password: 'test-only-long-construction-password', root, courseId: 'test-course', db: {} })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const headers = { Authorization: 'Basic ' + Buffer.from('academy:test-only-long-construction-password').toString('base64') }
  try {
    assert.equal((await fetch(base + '/walkthrough.mp4')).status, 401)
    const first = await fetch(base + '/walkthrough.mp4', { headers: { ...headers, Range: 'bytes=0-' } })
    assert.equal(first.status, 206)
    assert.equal(first.headers.get('content-range'), `bytes 0-1048575/${video.length}`)
    assert.equal((await first.arrayBuffer()).byteLength, 1048576)
    const seek = await fetch(base + '/walkthrough.mp4', { headers: { ...headers, Range: 'bytes=1500000-1500099' } })
    assert.equal(seek.status, 206)
    assert.equal((await seek.arrayBuffer()).byteLength, 100)
    assert.equal((await fetch(base + '/walkthrough.mp4', { headers: { ...headers, Range: 'bytes=9999999-' } })).status, 416)
    const captions = await fetch(base + '/captions.vtt', { headers })
    assert.match(captions.headers.get('content-type'), /^text\/vtt/)
    assert.match(await captions.text(), /^WEBVTT/)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true }) }
})
