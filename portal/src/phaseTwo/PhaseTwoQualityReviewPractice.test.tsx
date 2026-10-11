import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoQualityReviewPractice } from './PhaseTwoQualityReviewPractice'
import production from '../../../academy/phase-two-production/J6-L6-3-production.json'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
beforeEach(() => {
  vi.clearAllMocks()
  api.load.mockResolvedValue({ project_path:'B',project_title:'Continuing intake project',sections:{capstone_integration_package:{artifact_finish_lesson_6_2:{retained:true}},responsible_practice_statement:{earlier:'retained'},professional_positioning_evidence:{retained:true}} })
  api.save.mockResolvedValue({saved_version:33})
})
it('requires five READY checks and reviewed final statements, then patches only existing capstone and responsibility sections',async()=>{
  const {container}=render(<PhaseTwoQualityReviewPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request}/>)
  const save=await screen.findByRole('button',{name:'Save READY Review and Responsible Practice Statement to My Project Record'})
  expect(save).toHaveProperty('disabled',true)
  for(const x of [...container.querySelectorAll('textarea')].filter(x=>!x.readOnly))fireEvent.change(x,{target:{value:'Actual version 3 review: fictional tabletop only; human author owns correction; live use untested.'}})
  const statement=screen.getByLabelText(/^Final Responsible Practice Statement/)
  fireEvent.change(statement,{target:{value:''}});fireEvent.click(screen.getByRole('checkbox'));expect(save).toHaveProperty('disabled',true)
  fireEvent.change(statement,{target:{value:'I protect inputs, verify claims, retain review evidence, and correct and retest changes within the tabletop scope.'}})
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(save)
  await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
  const input=api.save.mock.calls[0][0]
  expect(input.path).toBe('B');expect(input.title).toBe('Continuing intake project')
  expect(Object.keys(input.patch)).toEqual(['capstone_integration_package','responsible_practice_statement'])
  expect(Object.keys(input.patch.capstone_integration_package)).toEqual(['quality_review_lesson_6_3'])
  expect(Object.keys(input.patch.responsible_practice_statement)).toEqual(['final_statement_lesson_6_3'])
  const evidence=input.patch.capstone_integration_package.quality_review_lesson_6_3
  expect(Object.keys(evidence.ready_quality_review)).toEqual(['relevant','evidenced','accountable','designed','yours'])
  expect(evidence.assigns_certification).toBe(false);expect(evidence.human_review_confirmed).toBe(true)
  expect(evidence.ai_request).not.toContain('[package]');expect(evidence.ai_request).toContain('Do not assign a certification decision.')
  expect(input.patch.responsible_practice_statement.final_statement_lesson_6_3.statement).toBe(evidence.responsible_practice_statement)
  expect(screen.getByRole('status').textContent).toContain('Version 33')
})
it('restores the saved statement without approving it and keeps owner review read-only',async()=>{
  api.load.mockResolvedValue({project_path:'B',project_title:'Existing project',sections:{capstone_integration_package:{quality_review_lesson_6_3:{draft:{statement:'Saved responsible commitments'}}}}})
  const {unmount}=render(<PhaseTwoQualityReviewPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request}/>)
  await waitFor(()=>expect(screen.getByLabelText(/^Final Responsible Practice Statement/)).toHaveProperty('value','Saved responsible commitments'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  unmount();vi.clearAllMocks();render(<PhaseTwoQualityReviewPractice approvedAiRequest={production.approved_ai_request}/>)
  expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Copy my Lesson 6.3 record'})).toBeTruthy()
})
