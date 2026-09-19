import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAcademyEmailFrom } from './sender.mjs'

test('preserves the verified ACA sender in Resend format', () => {
  assert.equal(
    formatAcademyEmailFrom('AI Confidence Academy <notifications@updates.aiconfidenceacademy.org>'),
    'AI Confidence Academy <notifications@updates.aiconfidenceacademy.org>',
  )
})

test('removes copied environment syntax and surrounding quotation marks', () => {
  assert.equal(
    formatAcademyEmailFrom('ACA_EMAIL_FROM="AI Confidence Academy <notifications@updates.aiconfidenceacademy.org>"'),
    'AI Confidence Academy <notifications@updates.aiconfidenceacademy.org>',
  )
})

test('refuses a sender value without a valid email address', () => {
  assert.equal(formatAcademyEmailFrom('AI Confidence Academy notifications'), null)
  assert.equal(formatAcademyEmailFrom(null), null)
})
