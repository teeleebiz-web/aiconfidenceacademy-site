import p from '../../../academy/phase-two-production/J2-L2-4-produced-lesson.json'
import w from '../../../academy/phase-two-production/J2-L2-4-workbook-page.json'
import { validProducedLesson } from './PhaseTwoProducedLessonReview'
import { LESSON_24_INTRO_TRANSCRIPT } from './phaseTwoLesson24Intro'
it('binds the complete comparison lesson, workbook and introduction to current 2.4', () => {
  expect(validProducedLesson(p, '2.4')).toBe(true)
  expect(w.lesson_id).toBe('2.4'); expect(w.number).toBe(4)
  expect(w.blocks.filter(x => x.type === 'field').length).toBe(21)
  expect(p.approved_ai_request).toContain('Compare no AI, assistant, rule-based automation and agent')
  expect(p.approved_ai_request).toContain('Do not propose live deployment.')
  expect(p.handoff).toContain('Lesson 2.5')
  expect(LESSON_24_INTRO_TRANSCRIPT).toContain('Phase Two, Journey Two, Lesson Four: Choose Assistants, Automation and Agents.')
  expect(LESSON_24_INTRO_TRANSCRIPT.endsWith("Let's begin.")).toBe(true)
  expect(p.reference_sources.every(x => /^https:\/\/(learn.microsoft.com|www.anthropic.com)\//.test(x.url))).toBe(true)
})
