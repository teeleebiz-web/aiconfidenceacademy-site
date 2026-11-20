import test from 'node:test'
import assert from 'node:assert/strict'
import { liveWelcomeState } from './approved-welcome-publication.mjs'

const original = 'a'.repeat(64), rendered = 'b'.repeat(64)
test('an interrupted readback accepts the exact completed upload without replacement', () => {
  assert.equal(liveWelcomeState(rendered, original, rendered), 'rendered')
})
test('replacement is allowed only while the fingerprinted original remains live', () => {
  assert.equal(liveWelcomeState(original, original, rendered), 'original')
  assert.throws(() => liveWelcomeState('c'.repeat(64), original, rendered), /differs/)
})
test('missing or malformed fingerprints cannot authorize publication', () => {
  for (const bad of [null, undefined, '', 'b'.repeat(63), 'G'.repeat(64)]) {
    assert.throws(() => liveWelcomeState(rendered, original, bad), /Invalid/)
  }
})
