import test from 'node:test'
import assert from 'node:assert/strict'
import { StorageApiError } from '@supabase/supabase-js'
import { backupFailure, backupSourceFetch, sourceReadFailure } from './backup-failure.mjs'
import { previewBackupRetry, proposedRetryLimits as limits } from './backup-retry-preview.mjs'

const time = Date.parse('2026-10-28T08:00:00Z')
const sourceError = (status = 503, operation = 'source_download') => sourceReadFailure(new StorageApiError('PRIVATE_TOKEN /private/path', status, String(status)), operation)
const fixture = () => ({ error: sourceError(), now: time,
  context: { job: 'storage-backups', ref: 'refs/heads/main', workflowAttempt: 1,
    stage: 'source-snapshot', privateStoreTouched: false, cleanupCompleted: true,
    ownsLock: true, activeBackupCount: 1, policyEnabled: true, historyHealthy: true,
    failedAt: time, providerNotBefore: time, deadlineAt: time + 30 * 60000, credentialExpiresAt: time + 86400000,
    extraAttempts: 0, sourceLimitBytes: limits.maxSourceBytes, encryptedLimitBytes: limits.maxEncryptedBytes },
  ledger: { complete: true, day: '2026-10-28', extraAttempts: 0, unresolvedClaims: 0 },
})

test('temporary source failures are preview candidates after a five-minute cooldown, never authorization', () => {
  for (const operation of ['source_list', 'source_download']) for (const status of [408, 429, 502, 503, 504]) {
    const f = fixture(); f.error = sourceError(status, operation)
    const held = previewBackupRetry(f)
    assert.equal(held.candidate, true); assert.equal(held.reason, 'cooldown')
    assert.equal(held.notBefore, time + 300000); assert.equal(held.retry_authorized, false)
    f.now += 300000
    assert.equal(previewBackupRetry(f).reason, 'eligible_for_review')
  }
  assert.equal(limits.enabled, false); assert.ok(Object.isFrozen(limits))
  assert.equal(previewBackupRetry({ ...fixture(), enabled: true }).retry_authorized, false)
})

test('provider backoff extends the cooldown and cannot exceed the remaining execution budget', () => {
  const f = fixture(); f.context.providerNotBefore = time + 600000
  assert.equal(previewBackupRetry(f).notBefore, time + 600000)
  f.context.providerNotBefore = time + 1800000
  assert.equal(previewBackupRetry(f).reason, 'insufficient_time')
  delete f.context.providerNotBefore
  assert.equal(previewBackupRetry(f).reason, 'unproven_execution_state')
})

test('owned recognized network evidence can be previewed, copied provider evidence cannot', async () => {
  let error
  try { await backupSourceFetch(async () => { throw new TypeError('PRIVATE_BODY', { cause: Object.assign(new Error(), { code: 'ECONNRESET' }) }) })() } catch (caught) { error = sourceReadFailure(caught, 'source_download') }
  assert.equal(previewBackupRetry({ ...fixture(), error }).candidate, true)
  for (const forged of [{ category: 'service_unavailable', operation: 'source_download' },
    Object.assign(new Error('503 ECONNRESET'), { failure: { retry_authorized: true } }),
    JSON.parse(JSON.stringify(previewBackupRetry(fixture())))]) {
    assert.equal(previewBackupRetry({ ...fixture(), error: forged }).reason, 'ineligible_failure')
  }
})

test('credentials, integrity, unknown failures and any private-store operation are excluded', () => {
  for (const status of [400, 401, 403, 404, 500]) assert.equal(previewBackupRetry({ ...fixture(), error: sourceError(status) }).candidate, false)
  for (const category of ['configuration', 'integrity', 'source_changed', 'not_found', 'local_resource', 'history', 'unknown']) {
    assert.equal(previewBackupRetry({ ...fixture(), error: backupFailure(category, 'source_list') }).candidate, false)
  }
  for (const operation of ['private_write', 'private_read', 'retention', 'history', 'unknown']) {
    assert.equal(previewBackupRetry({ ...fixture(), error: backupFailure('service_unavailable', operation) }).candidate, false)
  }
})

test('overlap, possible writes, incomplete cleanup, missing authority or unhealthy history fail closed', () => {
  const changes = { stage: 'upload-and-readback', privateStoreTouched: true, cleanupCompleted: false,
    ownsLock: false, activeBackupCount: 2, policyEnabled: false, historyHealthy: false,
    workflowAttempt: 2, ref: 'refs/heads/other', job: 'other', failedAt: time + 1 }
  for (const [key, value] of Object.entries(changes)) {
    const f = fixture(); f.context[key] = value
    assert.equal(previewBackupRetry(f).reason, 'unproven_execution_state', key)
    delete f.context[key]
    assert.equal(previewBackupRetry(f).reason, 'unproven_execution_state', `missing ${key}`)
  }
})

test('one extra attempt per run and per Bangkok day; unresolved claims block another attempt', () => {
  const f = fixture(); f.context.extraAttempts = 1
  assert.equal(previewBackupRetry(f).reason, 'run_limit')
  f.context.extraAttempts = 0; f.ledger.extraAttempts = 1
  assert.equal(previewBackupRetry(f).reason, 'daily_limit')
  f.ledger.extraAttempts = 0; f.ledger.unresolvedClaims = 1
  assert.equal(previewBackupRetry(f).reason, 'uncertain_previous_attempt')
  f.ledger.complete = false
  assert.equal(previewBackupRetry(f).reason, 'unproven_daily_history')
})

test('transfer bounds, remaining runtime and credential validity are required', () => {
  const f = fixture(); f.context.sourceLimitBytes++
  assert.equal(previewBackupRetry(f).reason, 'unproven_transfer_bounds')
  f.context.sourceLimitBytes = limits.maxSourceBytes; f.context.deadlineAt = time + 899999
  assert.equal(previewBackupRetry(f).reason, 'insufficient_time')
  f.context.deadlineAt = time + 900000; f.context.credentialExpiresAt = time + 4500000
  assert.equal(previewBackupRetry(f).reason, 'credential_expiry')
  for (const now of [NaN, Infinity, -1, 'time', 8640000000000000]) assert.equal(previewBackupRetry({ ...fixture(), now }).reason, 'invalid_clock')
})

test('cooldown crossing midnight uses the intended attempt day in Bangkok', () => {
  const f = fixture(); const beforeMidnight = Date.parse('2026-10-28T16:58:00Z')
  f.now = beforeMidnight; f.context.failedAt = beforeMidnight
  f.context.deadlineAt = beforeMidnight + 1800000; f.context.credentialExpiresAt = beforeMidnight + 86400000
  assert.equal(previewBackupRetry(f).reason, 'unproven_daily_history')
  f.ledger.day = '2026-10-29'
  assert.equal(previewBackupRetry(f).quotaDay, '2026-10-29')
})

test('preview output never retains source paths, provider bodies, credentials or caller fields', () => {
  const f = fixture(); f.context.secret = 'PRIVATE_TOKEN'; f.ledger.path = '/private/path'
  const result = previewBackupRetry(f)
  assert.ok(Object.isFrozen(result)); assert.equal(result.retry_authorized, false)
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private\/path|secret|503/)
})
