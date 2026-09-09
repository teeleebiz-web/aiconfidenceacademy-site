import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { cleanPlaybackEvents } from './playback-diagnostics.mjs'
import { createAcademyServer } from './server.mjs'

const event = { run: 'review1', media: 1, kind: 'video', event: 'playing', time: 2,
  duration: 60, ready: 4, network: 1, error: 0, paused: false, muted: false,
  volume: 1, width: 1920, height: 1080, visible: true, focused: true }

test('only bounded media state is retained, never arbitrary supplied text or URLs', () => {
  assert.deepEqual(cleanPlaybackEvents({ events: [{ ...event, src: 'https://example.test/private?token=secret', text: 'private' }] }), [event])
  assert.equal(cleanPlaybackEvents({ events: [{ ...event, event: 'arbitrary text' }] }), null)
  assert.equal(cleanPlaybackEvents({ events: [{ ...event, volume: 5 }] }), null)
  assert.equal(cleanPlaybackEvents({ events: Array(13).fill(event) }), null)
})

async function request({ enabled = false, authenticated = true, body = { events: [event] }, site = 'same-origin' } = {}) {
  const server = createAcademyServer({ password: 'synthetic-test-password-long-enough', root: '/tmp', courseId: 'test', db: {}, diagnosticsEnabled: enabled })
  const req = Readable.from([JSON.stringify(body)])
  req.method = 'POST'
  req.url = '/api/academy/playback-diagnostics'
  req.headers = { 'content-type': 'application/json', 'sec-fetch-site': site }
  if (authenticated) req.headers.authorization = 'Basic ' + Buffer.from('academy:synthetic-test-password-long-enough').toString('base64')
  return new Promise(resolve => {
    const res = { status: 0, setHeader() {}, writeHead(status) { this.status = status }, end() { resolve(this.status) } }
    server.emit('request', req, res)
  })
}

test('diagnostics stay disabled by default, authenticated and same-origin when enabled', async () => {
  assert.equal(await request(), 405)
  assert.equal(await request({ enabled: true, authenticated: false }), 401)
  assert.equal(await request({ enabled: true, site: 'cross-site' }), 400)
  assert.equal(await request({ enabled: true, body: { events: [{ ...event, volume: 8 }] } }), 400)
  const old = console.info
  const lines = []
  console.info = (...args) => lines.push(args)
  try {
    assert.equal(await request({ enabled: true }), 204)
    assert.equal(lines.length, 1)
    assert.equal(lines[0][0], 'ACA_PLAYBACK')
    assert.deepEqual(JSON.parse(lines[0][1]), event)
  } finally { console.info = old }
})
