import p from '../../../academy/phase-two-production/J2-L2-3-produced-lesson.json'
import w from '../../../academy/phase-two-production/J2-L2-3-workbook-page.json'
import { validProducedLesson } from './PhaseTwoProducedLessonReview'
import { LESSON_23_INTRO_TRANSCRIPT } from './phaseTwoLesson23Intro'
it('binds the complete CLEAR lesson, its workbook and introduction to current 2.3',()=>{
 expect(validProducedLesson(p,'2.3')).toBe(true)
 expect(w.lesson_id).toBe('2.3');expect(w.number).toBe(3)
 expect(w.blocks.filter((x:{type:string})=>x.type==='field').length).toBeGreaterThan(15)
 expect(p.approved_ai_request).toContain('Do not assert that facts are verified.')
 expect(p.handoff).toContain('Lesson 2.4')
 expect(LESSON_23_INTRO_TRANSCRIPT).toContain('Phase Two, Journey Two, Lesson Three: Verify and Revise with CLEAR.')
 expect(LESSON_23_INTRO_TRANSCRIPT.endsWith("Let's begin.")).toBe(true)
})
