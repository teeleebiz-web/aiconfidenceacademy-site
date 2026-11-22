import test from 'node:test'
import assert from 'node:assert/strict'
import { approvedWelcome as a, validateApprovedWelcome, verifyApprovedBytes } from './approved-welcome-script-two.mjs'
const task = { publication_key: a.key, source_sha256: a.approved, original_sha256: a.previous, status: 'approved' }
test('only the reviewed file and fingerprinted previous welcome authorize replacement', () => {
  assert.equal(validateApprovedWelcome(task, a.previous), 'replace')
  assert.throws(() => validateApprovedWelcome(task, 'a'.repeat(64)), /changed/)
  assert.throws(() => validateApprovedWelcome({ ...task, source_sha256: 'a'.repeat(64) }, a.previous), /fingerprint/)
})
test('completed upload can recover without replacing it again', () => {
  assert.equal(validateApprovedWelcome({ ...task, status: 'failed' }, a.approved), 'complete')
  assert.throws(() => validateApprovedWelcome({ ...task, status: 'verified' }, a.previous), /changed/)
})
test('wrong or truncated staged bytes cannot be published', () => {
  assert.throws(() => verifyApprovedBytes(Buffer.from('not the reviewed film')), /does not match/)
  assert.throws(() => verifyApprovedBytes(Buffer.alloc(a.bytes)), /does not match/)
})
