import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, StorageApiError } from '@supabase/supabase-js'
import { S3ServiceException } from '@aws-sdk/client-s3'
import { backupFailure, backupFailureEvidence, backupSourceFetch, privateStoreFailure, sourceReadFailure } from './backup-failure.mjs'
import { r2Store } from './r2-transfer.mjs'

test('only SDK HTTP status and bounded integrity codes become finite source-read evidence', () => {
  for (const [status, category] of [[401, 'credential_or_access'], [403, 'credential_or_access'], [408, 'service_unavailable'], [429, 'service_unavailable'], [502, 'service_unavailable'], [503, 'service_unavailable'], [504, 'service_unavailable'], [404, 'not_found'], [500, 'unknown'], [400, 'unknown']]) {
    const error = new StorageApiError('PRIVATE_PATH PRIVATE_TOKEN retry everything', status, '503', 'storage', 'PRIVATE_CODE')
    assert.deepEqual(backupFailureEvidence(sourceReadFailure(error, 'source_list')), { category, operation: 'source_list', retry_authorized: false })
  }
  const checksum = new StorageApiError('PRIVATE_PATH', 400, '400', 'storage', 'InvalidChecksum')
  assert.equal(backupFailureEvidence(sourceReadFailure(checksum, 'source_download')).category, 'integrity')
  checksum.status = 403
  assert.equal(backupFailureEvidence(sourceReadFailure(checksum, 'source_download')).category, 'credential_or_access')
})

test('provider text, forged JSON, mutable error fields and a copied evidence object cannot authorize a retry', () => {
  for (const error of [{ status: 503, name: 'StorageApiError', failure: { category: 'service_unavailable' } }, Object.assign(new Error('ECONNRESET 503 PRIVATE_TOKEN'), { status: 503, failure: { retry_authorized: true } }), { category: 'service_unavailable', operation: 'source_list', retry_authorized: true }]) {
    assert.equal(backupFailureEvidence(error).category, 'unknown')
    assert.equal(backupFailureEvidence(sourceReadFailure(error, 'source_list')).category, 'unknown')
    assert.equal(backupFailureEvidence(sourceReadFailure(error, 'source_list')).retry_authorized, false)
  }
  assert.throws(() => backupFailure('PRIVATE_PROVIDER_TEXT', 'source_list'))
  assert.throws(() => backupFailure('unknown', 'arbitrary-operation'))
  const safe = backupFailureEvidence(backupFailure('integrity', 'integrity_check'))
  assert.ok(Object.isFrozen(safe)); assert.throws(() => { safe.retry_authorized = true })
})

test('actual SDK wrapping preserves only owned network evidence and the correct read operation, without retrying', async () => {
  let calls = 0
  const transport = Object.assign(new Error('PRIVATE_SOCKET_DETAIL'), { code: 'ECONNRESET' })
  const client = createClient('https://ymmkodlifpxutynpjnxm.supabase.co', 'test-only', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: backupSourceFetch(async () => { calls++; throw new TypeError('PRIVATE_FETCH_DETAIL', { cause: transport }) }) } })
  const result = await client.storage.listBuckets()
  const failure = backupFailureEvidence(sourceReadFailure(result.error, 'source_list'))
  assert.deepEqual(failure, { category: 'network_interruption', operation: 'source_list', retry_authorized: false })
  assert.equal(calls, 1); assert.doesNotMatch(JSON.stringify(failure), /PRIVATE_/)
})

test('a real SDK response uses HTTP status rather than a contradictory provider-body status or message', async () => {
  const client = createClient('https://ymmkodlifpxutynpjnxm.supabase.co', 'test-only', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: backupSourceFetch(async () => new Response(JSON.stringify({ message: 'PRIVATE_BODY', statusCode: '401', code: 'PRIVATE_BODY_CODE' }), { status: 503, headers: { 'content-type': 'application/json' } })) } })
  const result = await client.storage.listBuckets()
  const failure = backupFailureEvidence(sourceReadFailure(result.error, 'source_list'))
  assert.equal(failure.category, 'service_unavailable'); assert.equal(failure.retry_authorized, false)
  assert.doesNotMatch(JSON.stringify(failure), /PRIVATE_|401|503/)
})

test('unrecognized network failures remain unknown, and the capture wrapper leaves successful responses unchanged', async () => {
  const response = new Response('fixture')
  assert.equal(await backupSourceFetch(async () => response)('fixture'), response)
  for (const error of [new Error('PRIVATE_UNKNOWN'), Object.assign(new Error('PRIVATE_DNS'), { code: 'ENOTFOUND' }), { code: 'ECONNRESET' }]) {
    await assert.rejects(backupSourceFetch(async () => { throw error })('fixture'), captured => backupFailureEvidence(captured).category === 'unknown')
  }
})

test('private-store operations retain their identity and never turn possible writes or retention failures into permission', () => {
  for (const operation of ['private_read', 'private_write', 'retention']) {
    for (const [status, category] of [[403, 'credential_or_access'], [503, 'service_unavailable'], [500, 'unknown']]) {
      const cause = new S3ServiceException({ name: 'PRIVATE_PROVIDER_NAME', message: 'PRIVATE_PROVIDER_BODY', $fault: 'server', $metadata: { httpStatusCode: status, requestId: 'PRIVATE_ID' } })
      assert.deepEqual(backupFailureEvidence(privateStoreFailure(cause, operation)), { category, operation, retry_authorized: false })
    }
  }
  assert.equal(backupFailureEvidence(privateStoreFailure({ $metadata: { httpStatusCode: 503 } }, 'private_read')).category, 'unknown')
})

test('the real R2 adapter preserves each failed operation with one SDK call and no provider-detail leakage', async () => {
  for (const [method, operation] of [['get', 'private_read'], ['put', 'private_write'], ['remove', 'retention']]) {
    let calls = 0
    const store = r2Store({ bucket: 'private-fixture' }, { async send() { calls++; throw new S3ServiceException({ name: 'PRIVATE_NAME', message: 'PRIVATE_BODY /private/path', $fault: 'client', $metadata: { httpStatusCode: 403, requestId: 'PRIVATE_REQUEST' } }) } })
    await assert.rejects(store[method]('fixture', Buffer.from('fixture'), 7), error => {
      assert.deepEqual(backupFailureEvidence(error), { category: 'credential_or_access', operation, retry_authorized: false })
      assert.doesNotMatch(error.message + JSON.stringify(error), /PRIVATE_|private\/path/)
      return true
    })
    assert.equal(calls, 1)
  }
})
