import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoOpportunityPractice } from './PhaseTwoOpportunityPractice'
import production from '../../../academy/phase-two-production/J6-L6-5-production.json'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const sample75=production.worked_case.revised_example.split('SUPPLIED FICTIONAL 75-WORD INTRODUCTION: ')[1].split('\n\n')[0]
const sample40=production.worked_case.revised_example.split('SUPPLIED FICTIONAL 40-WORD PROFILE: ')[1].split('\n\n')[0]
beforeEach(()=>{
  vi.clearAllMocks()
  api.load.mockResolvedValue({project_path:'B',project_title:'Continuing intake project',sections:{professional_positioning_evidence:{capability_lesson_6_1:{retained:true}},capstone_integration_package:{retained:true}}})
  api.save.mockResolvedValue({saved_version:35})
})
it('requires exact language formats and human review, then patches only the existing positioning section',async()=>{
  const {container}=render(<PhaseTwoOpportunityPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request}/>)
  const save=await screen.findByRole('button',{name:'Save Positioning Language and Opportunity Map to My Project Record'})
  expect(save).toHaveProperty('disabled',true)
  for(const x of [...container.querySelectorAll('textarea')].filter(x=>!x.readOnly))fireEvent.change(x,{target:{value:'Reviewed fictional prototype evidence; permitted review proposed; actual permission and live use remain unestablished.'}})
  fireEvent.change(screen.getByLabelText(/^75-word professional introduction/),{target:{value:sample75}})
  fireEvent.change(screen.getByLabelText(/^40-word profile/),{target:{value:sample40}})
  const bullets=screen.getByLabelText(/^Three evidence-based bullets/)
  fireEvent.change(bullets,{target:{value:'Designed a bounded fictional intake example.\nChecked the three retained tabletop paths.'}})
  fireEvent.click(screen.getByRole('checkbox'));expect(save).toHaveProperty('disabled',true)
  fireEvent.change(bullets,{target:{value:'Designed a bounded fictional intake example.\nChecked the three retained tabletop paths.\nRevised the written state and human approval gate.'}})
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  const profile=screen.getByLabelText(/^40-word profile/)
  fireEvent.change(profile,{target:{value:sample40+' unsupported'}});fireEvent.click(screen.getByRole('checkbox'));expect(save).toHaveProperty('disabled',true)
  fireEvent.change(profile,{target:{value:sample40}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(save)
  await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
  const input=api.save.mock.calls[0][0]
  expect(input.path).toBe('B');expect(input.title).toBe('Continuing intake project')
  expect(Object.keys(input.patch)).toEqual(['professional_positioning_evidence'])
  expect(Object.keys(input.patch.professional_positioning_evidence)).toEqual(['positioning_lesson_6_5'])
  const e=input.patch.professional_positioning_evidence.positioning_lesson_6_5
  expect(e.word_counts).toEqual({introduction:75,profile:40});expect(e.language_set.bullets).toHaveLength(3)
  expect(Object.keys(e.opportunity_map)).toEqual(['current_role_or_setting','adjacent','longer_term'])
  expect(e.ai_request).not.toContain('[notes]');expect(e.ai_request).toContain('Do not add credentials or guarantees.')
  expect(e.human_review_confirmed).toBe(true);expect(e.assigns_certification).toBe(false)
  expect(screen.getByRole('status').textContent).toContain('Version 35')
})
it('restores the saved profile without approving it and keeps founder review read-only',async()=>{
  api.load.mockResolvedValue({project_path:'B',project_title:'Existing project',sections:{professional_positioning_evidence:{positioning_lesson_6_5:{draft:{profile:sample40}}}}})
  const {unmount}=render(<PhaseTwoOpportunityPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request}/>)
  await waitFor(()=>expect(screen.getByLabelText(/^40-word profile/)).toHaveProperty('value',sample40))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  unmount();vi.clearAllMocks();render(<PhaseTwoOpportunityPractice approvedAiRequest={production.approved_ai_request}/>)
  expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Copy my Lesson 6.5 record'})).toBeTruthy()
})
