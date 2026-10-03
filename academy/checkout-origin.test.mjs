import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createAcademyServer } from './server.mjs'

const password = 'test-only-long-construction-password'
const auth = { Authorization: 'Basic ' + Buffer.from('academy:' + password).toString('base64') }

test('only preview enrollment pages preserve the origin needed by checkout forms', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aca-origin-'))
  await mkdir(join(root, 'enroll'))
  await writeFile(join(root, 'enroll', 'index.html'), '<form method="post"><button>Pay $149</button></form>')
  await writeFile(join(root, 'index.html'), '<h1>Academy</h1>')
  try {
    for (const preview of [false, true]) {
      const server = createAcademyServer({ password, root, courseId: 'test-course', db: {}, enrollmentAutomation: { preview } })
      server.listen(0, '127.0.0.1'); await once(server, 'listening')
      const base = `http://127.0.0.1:${server.address().port}`
      try {
        for (const path of ['/enroll', '/enroll/', '/enroll/index.html']) {
          const response = await fetch(base + path, { headers: auth })
          assert.equal(response.status, 200)
          assert.equal(response.headers.get('referrer-policy'), preview ? 'same-origin' : 'no-referrer')
        }
        const otherPage = await fetch(base + '/', { headers: auth })
        assert.equal(otherPage.headers.get('referrer-policy'), 'no-referrer')
        assert.equal((await fetch(base + '/enroll/')).status, 401)
      } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    }
  } finally { await rm(root, { recursive: true }) }
})

test('preview checkout accepts its origin, rejects null or foreign origins, and never activates learners', async () => {
  const calls = []
  const server = createAcademyServer({
    password, root: tmpdir(), courseId: 'test-course',
    db: { from() { throw new Error('Checkout must not access learner records') } },
    enrollmentAutomation: {
      preview: true, appUrl: 'https://preview.vercel.app',
      phaseOnePriceId: 'price_1UJPLZISbjgQbMXEczom8HVV', courseId: 'test-course',
      stripe: { checkout: { sessions: { async create(payload) {
        calls.push(payload)
        return { url: 'https://checkout.stripe.com/c/pay/cs_test_example' }
      } } } },
    },
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const endpoint = `http://127.0.0.1:${server.address().port}/api/enrollment/phase-one/paid-in-full`
  try {
    for (const origin of ['null', 'https://other.vercel.app']) {
      const response = await fetch(endpoint, { method: 'POST', headers: { Host: 'preview.vercel.app', Origin: origin }, redirect: 'manual' })
      assert.equal(response.status, 403)
    }
    assert.equal(calls.length, 0)
    const response = await fetch(endpoint, { method: 'POST', headers: { Host: 'preview.vercel.app', Origin: 'https://preview.vercel.app' }, redirect: 'manual' })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('location'), 'https://checkout.stripe.com/c/pay/cs_test_example')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].line_items[0].price, 'price_1UJPLZISbjgQbMXEczom8HVV')
    assert.equal(calls[0].success_url, 'https://preview.vercel.app/enroll/?payment=success')
    assert.equal(calls[0].cancel_url, 'https://preview.vercel.app/enroll/?payment=canceled')
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
