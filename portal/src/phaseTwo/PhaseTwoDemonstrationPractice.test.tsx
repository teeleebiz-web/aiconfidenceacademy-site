import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoDemonstrationPractice } from './PhaseTwoDemonstrationPractice'
import production from '../../../academy/phase-two-production/J6-L6-4-production.json'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
beforeEach(() => {
  vi.clearAllMocks()
  api.load.mockResolvedValue({ project_path:'B',project_title:'Continuing intake project',sections:{capstone_integration_package:{quality_review_lesson_6_3:{retained:true}},responsible_practice_statement:{retained:true},professional_positioning_evidence:{retained:true}} })
  api.save.mockResolvedValue({saved_version:34})
})
it('requires the STORY outline, rehearsal and own delivery evidence, then patches only the continuing capstone section',async()=>{
  const {container}=render(<PhaseTwoDemonstrationPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request}/>)
  const save=await screen.findByRole('button',{name:'Save STORY Demonstration and Questions to My Project Record'})
  expect(save).toHaveProperty('disabled',true)
  for(const x of [...container.querySelectorAll('textarea')].filter(x=>!x.readOnly))fireEvent.change(x,{target:{value:'My reviewed tabletop explanation: normal path and approval exception; retained evidence and live-use limit.'}})
  const delivery=screen.getByLabelText(/^Actual five-to-seven-minute delivery/)
  fireEvent.change(delivery,{target:{value:''}});fireEvent.click(screen.getByRole('checkbox'));expect(save).toHaveProperty('disabled',true)
  fireEvent.change(delivery,{target:{value:'6:12 actual delivery, safe presentation reference, own explanation of tests, changed decision, and limit.'}})
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(save)
  await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
  const input=api.save.mock.calls[0][0]
  expect(input.path).toBe('B');expect(input.title).toBe('Continuing intake project')
  expect(Object.keys(input.patch)).toEqual(['capstone_integration_package'])
  expect(Object.keys(input.patch.capstone_integration_package)).toEqual(['story_demonstration_lesson_6_4'])
  const e=input.patch.capstone_integration_package.story_demonstration_lesson_6_4
  expect(Object.keys(e.story_outline)).toEqual(['situation','target','operations','result','your_judgment'])
  expect(e.ai_answers_on_behalf).toBe(false);expect(e.assigns_certification).toBe(false);expect(e.human_review_confirmed).toBe(true)
  expect(e.ai_request).not.toContain('[draft]');expect(e.ai_request).toContain('Do not invent results or answer on my behalf.')
  expect(e.actual_delivery_and_timing).toContain('6:12');expect(e.own_question_response_notes).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('Version 34')
})
it('restores the saved cue sheet without approving it and keeps founder preview read-only',async()=>{
  api.load.mockResolvedValue({project_path:'B',project_title:'Existing project',sections:{capstone_integration_package:{story_demonstration_lesson_6_4:{draft:{cueSheet:'Saved five-part cue sheet'}}}}})
  const {unmount}=render(<PhaseTwoDemonstrationPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request}/>)
  await waitFor(()=>expect(screen.getByLabelText(/^One-page cue sheet/)).toHaveProperty('value','Saved five-part cue sheet'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  unmount();vi.clearAllMocks();render(<PhaseTwoDemonstrationPractice approvedAiRequest={production.approved_ai_request}/>)
  expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Copy my Lesson 6.4 record'})).toBeTruthy()
})
