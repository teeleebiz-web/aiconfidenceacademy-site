import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { handleLessonReleaseTest } from './lesson-release-test.mjs'

const response = () => ({
  status: 0,
  payload: '',
  writeHead(status) { this.status = status },
  end(value = '') { this.payload = value },
})

function request(body, authorization = 'Bearer secret') {
  const req = Object.assign(new EventEmitter(), {
    method: 'POST',
    headers: { authorization },
    [Symbol.asyncIterator]: async function* () {
      if (body !== undefined) yield Buffer.from(body)
    },
  })
  return req
}

function configuration(overrides = {}) {
  const messages = []
  return {
    messages,
    cronSecret: 'secret',
    emailFrom: 'AI Confidence Academy <notifications@updates.aiconfidenceacademy.org>',
    appUrl: 'https://aiconfidenceacademy.org',
    lessonReleaseMessage: (candidate, details) => ({
      subject: 'Your next ACA lesson is ready',
      html: `<p>${details.learnerFirstName || 'Learner'}: ${candidate.pageId}</p>`,
    }),
    resend: {
      emails: {
        send: async (message, options) => {
          messages.push({ message, options })
          return { data: { id: 'email-test-1' }, error: null }
        },
      },
    },
    ...overrides,
  }
}

test('rejects an unauthorized test request without sending email', async () => {
  const config = configuration()
  const res = response()
  await handleLessonReleaseTest(request('{"to":"owner@example.com"}', 'Bearer wrong'), res, config)
  assert.equal(res.status, 401)
  assert.equal(config.messages.length, 0)
})

test('requires a valid recipient address', async () => {
  const config = configuration()
  const res = response()
  await handleLessonReleaseTest(request('{"to":"not-an-email"}'), res, config)
  assert.equal(res.status, 400)
  assert.equal(config.messages.length, 0)
})

test('sends one clearly marked test message without creating a learner event', async () => {
  const config = configuration()
  const res = response()
  await handleLessonReleaseTest(request('{"to":"Owner@Example.com","firstName":"Terrence"}'), res, config)

  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.payload), {
    ok: true,
    recipient: 'owner@example.com',
    providerMessageId: 'email-test-1',
  })
  assert.equal(config.messages.length, 1)
  assert.equal(config.messages[0].message.to, 'owner@example.com')
  assert.equal(config.messages[0].message.subject, '[TEST] Your next ACA lesson is ready')
  assert.match(config.messages[0].message.html, /does not release a lesson or change learner access/)
  assert.match(config.messages[0].message.html, /Terrence: TEST/)
})

test('returns a safe error when the email provider rejects the test', async () => {
  const config = configuration({
    resend: { emails: { send: async () => ({ data: null, error: { message: 'provider detail' } }) } },
  })
  const res = response()
  await handleLessonReleaseTest(request('{"to":"owner@example.com"}'), res, config)
  assert.equal(res.status, 502)
  assert.deepEqual(JSON.parse(res.payload), {
    error: 'ACA test email could not be sent',
    provider: { message: 'provider detail' },
  })
})

test('redacts an API key if a provider error unexpectedly includes it', async () => {
  const config = configuration({
    resend: { emails: { send: async () => { throw new Error('Rejected re_exampleSecretValue') } } },
  })
  const res = response()
  await handleLessonReleaseTest(request('{"to":"owner@example.com"}'), res, config)
  assert.equal(res.status, 502)
  assert.deepEqual(JSON.parse(res.payload), {
    error: 'ACA test email could not be sent',
    provider: { name: 'Error', message: 'Rejected [redacted]' },
  })
})
