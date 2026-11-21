import p from '../../../academy/phase-two-production/J2-L2-6-produced-lesson.json'
import w from '../../../academy/phase-two-production/J2-L2-6-workbook-page.json'
import m from '../../../academy/phase-two-production/J2-L2-6-media-transcripts.json'
import { validProducedLesson } from './PhaseTwoProducedLessonReview'
import { LESSON_26_INTRO_TRANSCRIPT } from './phaseTwoLesson26Intro'
it('binds the final Journey Two lesson to the current master, actual tests and Journey Three handoff', () => {
  expect(validProducedLesson(p, '2.6')).toBe(true)
  expect(w.lesson_id).toBe('2.6'); expect(w.number).toBe(6)
  expect(w.blocks.filter(x => x.type === 'field').length).toBe(29)
  expect(p.approved_ai_request).toBe('Suggest difficult but realistic test inputs for this bounded prototype. Include missing information, conflicting instructions and an out-of-scope request. State expected safe behavior for my review. Scope: [brief].')
  expect(p.handoff).toContain('Lesson 3.1: Understand the People Affected by Change')
  expect(p.completion_criteria.some(x => x.includes('same input and original expectation'))).toBe(true)
  expect(p.teaching.some(x => x.paragraphs.some(t => t.includes('clarity, usefulness, review effort and outcome quality')))).toBe(true)
  expect(p.worked_case.setup).toContain('scripted teaching illustration')
  expect(LESSON_26_INTRO_TRANSCRIPT).toContain('Phase Two, Journey Two, Lesson Six: Test Errors and Exception Paths.')
  expect(LESSON_26_INTRO_TRANSCRIPT.endsWith("Let's begin.")).toBe(true)
  expect(m.chapters).toHaveLength(4); expect(m.demos).toHaveLength(4)
})
it('accepts Saturday integration pacing and rejects a mismatched application allocation', () => {
  expect(p.pacing.map(x => x.minutes)).toEqual([10, 10, 30, 10])
  expect(p.application.reduce((sum, x) => sum + x.minutes, 0)).toBe(30)
  expect(validProducedLesson({...p, application: p.application.map((x, i) => ({...x, minutes: i === 0 ? x.minutes - 5 : x.minutes}))}, '2.6')).toBe(false)
})
