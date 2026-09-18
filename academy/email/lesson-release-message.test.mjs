import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonReleaseMessage } from './lesson-release-message.mjs'

test('renders the approved lesson-release wording with the two-hour access window', () => {
  const message = lessonReleaseMessage({ pageId: '2.1', lessonTitle: 'Shape Your Request' }, {
    appUrl: 'https://aiconfidenceacademy.com', learnerFirstName: 'Jordan',
  })
  assert.equal(message.subject, 'Your next ACA lesson is ready')
  assert.match(message.html, /Hello Jordan,/)
  assert.match(message.html, /Lesson 2\.1: Shape Your Request/)
  assert.match(message.html, /two-hour lesson access window starts when you open the lesson/)
  assert.match(message.html, /https:\/\/aiconfidenceacademy\.com\/learn\//)
})

test('escapes learner and lesson data before placing it in the email', () => {
  const message = lessonReleaseMessage({ pageId: '1.1', lessonTitle: '<unsafe>' }, {
    appUrl: 'https://aiconfidenceacademy.com', learnerFirstName: '<name>',
  })
  assert.doesNotMatch(message.html, /<unsafe>|<name>/)
})
