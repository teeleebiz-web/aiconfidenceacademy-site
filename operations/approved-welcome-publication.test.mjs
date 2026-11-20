import test from 'node:test'
import assert from 'node:assert/strict'
import { liveWelcomeState, verifyWelcomeFrameScores } from './approved-welcome-publication.mjs'

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
test('composition recovery requires every frame in sequence at the strict similarity threshold', () => {
  const scores = 'n:1 Y:1.000000 U:1.000000 V:1.000000 All:1.000000 (inf)\nn:2 Y:0.999999 U:1.000000 V:1.000000 All:0.999999 (60.0)\n'
  assert.doesNotThrow(() => verifyWelcomeFrameScores(scores, 2))
  assert.throws(() => verifyWelcomeFrameScores(scores, 3), /count/)
  assert.throws(() => verifyWelcomeFrameScores(scores.replace('n:2', 'n:3'), 2), /differs/)
  assert.throws(() => verifyWelcomeFrameScores(scores.replace('All:0.999999', 'All:0.998999'), 2), /differs/)
  assert.throws(() => verifyWelcomeFrameScores(scores.replace('All:0.999999', 'All:NaN'), 2), /differs/)
})
