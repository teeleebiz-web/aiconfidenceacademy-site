import p from '../../../academy/phase-two-production/J2-L2-5-produced-lesson.json'
import w from '../../../academy/phase-two-production/J2-L2-5-workbook-page.json'
import m from '../../../academy/phase-two-production/J2-L2-5-media-transcripts.json'
import { validProducedLesson } from './PhaseTwoProducedLessonReview'
import { LESSON_25_INTRO_TRANSCRIPT } from './phaseTwoLesson25Intro'
it('binds the prototype lesson, workbook and introduction to current 2.5 and the BUILD evidence cycle', () => {
  expect(validProducedLesson(p, '2.5')).toBe(true)
  expect(w.lesson_id).toBe('2.5'); expect(w.number).toBe(5)
  expect(w.blocks.filter(x => x.type === 'field').length).toBe(21)
  expect(p.approved_ai_request).toBe('Help build a minimal working sample for this authorized scope using these inputs and acceptance criteria. Flag missing information and assumptions. Keep approval with me. Project: [charter and map].')
  expect(p.handoff).toContain('Lesson 2.6')
  expect(p.teaching.some(x => x.paragraphs.some(t => t.includes('baseline, use AI, inspect, lead and demonstrate')))).toBe(true)
  expect(p.completion_criteria.some(x => x.includes('actual rerun using the same normal input'))).toBe(true)
  expect(p.worked_case.setup).toContain('scripted teaching illustration')
  expect(LESSON_25_INTRO_TRANSCRIPT).toContain('Phase Two, Journey Two, Lesson Five: Build a Bounded Working Prototype.')
  expect(LESSON_25_INTRO_TRANSCRIPT.endsWith("Let's begin.")).toBe(true)
  expect(m.chapters).toHaveLength(4); expect(m.demos).toHaveLength(4)
  expect(m.demos.every(x => x.scenes.length === 3)).toBe(true)
})
