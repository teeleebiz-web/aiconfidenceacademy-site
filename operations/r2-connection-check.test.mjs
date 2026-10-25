import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { checkConnection } from './r2-connection-check.mjs'

const env = { ACA_R2_PRIVATE_CONFIRMED: `${'a'.repeat(32)}/aca-private-backups`, ACA_R2_ACCESS_KEY_ID: 'PRIVATE_ACCESS_KEY', ACA_R2_SECRET_ACCESS_KEY: 'PRIVATE_SECRET' }

test('connection check encrypts independent bytes, reads them back, downloads and compares recovered bytes', async () => {
  const objects = new Map(), calls = []
  const result = await checkConnection({ env, createStore(config) {
    assert.equal(config.bucket, 'aca-private-backups')
    assert.equal(config.maxBytes, 65536)
    return {
      async put(path, body) {
        assert.ok(!objects.has(path))
        const bytes = Buffer.isBuffer(body) ? body : Buffer.concat(await Readable.from(body).toArray())
        objects.set(path, bytes); calls.push(['put', path])
      },
      async get(path) { calls.push(['get', path]); return Readable.from([objects.get(path)]) },
    }
  } })
  assert.equal(result.connectionVerified, true)
  assert.equal(result.syntheticOnly, true)
  assert.equal(result.liveAcaBackup, false)
  assert.equal(result.originalBytes, 4096)
  assert.equal(objects.size, 4)
  assert.ok([...objects.keys()].every(path => path.startsWith('aca-connection-checks/')))
  assert.match(result.reference, /^aca-connection-checks\//)
  assert.ok(result.encryptedBytes < 65536)
  assert.equal(calls.filter(([type]) => type === 'get').length, 8)
  for (const value of objects.values()) {
    assert.ok(!value.includes(Buffer.from(env.ACA_R2_ACCESS_KEY_ID)))
    assert.ok(!value.includes(Buffer.from(env.ACA_R2_SECRET_ACCESS_KEY)))
  }
})

test('missing credentials, different buckets and malformed confirmations stop before contacting R2', async () => {
  for (const patch of [{ ACA_R2_ACCESS_KEY_ID: '' }, { ACA_R2_SECRET_ACCESS_KEY: '' }, { ACA_R2_PRIVATE_CONFIRMED: '' }, { ACA_R2_PRIVATE_CONFIRMED: `${'a'.repeat(32)}/different-bucket` }]) {
    await assert.rejects(checkConnection({ env: { ...env, ...patch }, createStore() { assert.fail('Must not initialize R2') } }), error => error.stage === 'configuration')
  }
})

test('provider failure remains a failure with no provider response or credential in the reported error', async () => {
  await assert.rejects(checkConnection({ env, createStore() { return { async put() { throw new Error('PRIVATE_SECRET provider detail') } } } }), error => {
    assert.equal(error.stage, 'upload-and-readback')
    assert.match(error.reference, /^aca-connection-checks\//)
    assert.ok(!error.message.includes('PRIVATE_SECRET'))
    assert.ok(!JSON.stringify(error).includes('provider detail'))
    return true
  })
})
