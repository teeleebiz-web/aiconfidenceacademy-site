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

test('uses the official verified sender when the stored value has no email address', () => {
  assert.equal(
    formatAcademyEmailFrom('AI Confidence Academy notifications'),
    'AI Confidence Academy <notifications@updates.aiconfidenceacademy.org>',
  )
  assert.equal(
    formatAcademyEmailFrom(null),
    'AI Confidence Academy <notifications@updates.aiconfidenceacademy.org>',
  )
})
