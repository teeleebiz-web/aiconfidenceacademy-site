import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoExperienceDesignPractice } from './PhaseTwoExperienceDesignPractice'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
const request='Design this experience around Person, Situation, Purpose, Result, Evidence and Boundary. Sequence orientation, explanation, example, practice, review, application and continuation. Keep the stated scope. Brief: [inputs].'
const record={project_path:'B',project_title:'Existing service guide',sections:{digital_delivery_artifact:{offer_lesson_4_1:{offer_sentence:'Bounded estimate guide',scope:{exclusions:'No quote approval'},audience_test_assumptions:'Actual usefulness untested'}},leadership_and_adoption_plan:{readiness_lesson_3_4:{draft:{show:'Existing worked task example',remaining:'Authorized access unresolved'},test_type:'simulation'}}}}
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue(record);api.save.mockResolvedValue({saved_version:16})})
const saveButton=()=>screen.getByRole('button',{name:/Save sample and outline/})
function complete(container:HTMLElement){
 container.querySelectorAll('textarea').forEach(x=>{if(!x.readOnly)fireEvent.change(x,{target:{value:'Checked complete sample; $115 fictional subtotal; scenario only; actual usefulness untested.'}})})
 fireEvent.click(screen.getByRole('checkbox'))
}
it('continues the saved offer and references staff practice without inventing approval',async()=>{
 render(<PhaseTwoExperienceDesignPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Saved 4.1 offer/)).toHaveProperty('value',expect.stringContaining('Bounded estimate guide')))
 expect(screen.getByLabelText(/Saved 4.1 offer/)).toHaveProperty('value',expect.stringContaining('No quote approval'))
 expect(screen.getByLabelText(/Reference to 3.4/)).toHaveProperty('value',expect.stringContaining('simulation'))
 expect(screen.getByLabelText(/Reference to 3.4/)).toHaveProperty('value',expect.stringContaining('Authorized access unresolved'))
 expect(screen.getByLabelText(/Continuing project and/)).toHaveProperty('value',expect.stringContaining('Path B'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('saves only the experience section with the frame, complete sample and demonstrated correction',async()=>{
 const {container}=render(<PhaseTwoExperienceDesignPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save sample and outline/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
 const input=api.save.mock.calls[0][0];expect(input.path).toBe('B');expect(input.title).toBe(record.project_title)
 expect(Object.keys(input.patch)).toEqual(['digital_delivery_artifact'])
 expect(Object.keys(input.patch.digital_delivery_artifact)).toEqual(['experience_lesson_4_2'])
 const e=input.patch.digital_delivery_artifact.experience_lesson_4_2
 expect(Object.keys(e.audience_purpose_result_frame)).toHaveLength(6)
 expect(Object.keys(e.experience_outline)).toHaveLength(7)
 expect(e.complete_sample).toBe(e.draft.sample);expect(e.applied_check.removed_section).toBe(e.draft.removedSection)
 expect(e.checks.accessibility).toBe(e.draft.accessibilityCheck)
 expect(e.scenario_establishes_audience_usefulness).toBe(false);expect(e.saved_record_grants_publication_permission).toBe(false)
 expect(e.ai_request).toContain('Keep the stated scope');expect(e.ai_request).not.toContain('[inputs]')
 expect(screen.getByRole('status').textContent).toContain('Version 16')
})
it('requires complete sample evidence and fresh human review after an edit',async()=>{
 const {container}=render(<PhaseTwoExperienceDesignPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save sample and outline/});complete(container)
 fireEvent.change(screen.getByLabelText(/Small complete sample/),{target:{value:'Revised sample'}})
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false);expect(saveButton()).toHaveProperty('disabled',true)
 fireEvent.click(screen.getByRole('checkbox'));expect(saveButton()).toHaveProperty('disabled',false)
 fireEvent.change(screen.getByLabelText(/Applied check — demonstrate/),{target:{value:''}});fireEvent.click(screen.getByRole('checkbox'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('retains answers on save failure and restores the saved draft before prior context',async()=>{
 api.save.mockRejectedValue(new Error('Unavailable'))
 const {container,unmount}=render(<PhaseTwoExperienceDesignPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save sample and outline/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
 const saved=api.save.mock.calls[0][0].patch.digital_delivery_artifact.experience_lesson_4_2
 expect(screen.getByLabelText(/Small complete sample/)).toHaveProperty('value',saved.draft.sample)
 unmount();api.load.mockResolvedValue({...record,sections:{...record.sections,digital_delivery_artifact:{...record.sections.digital_delivery_artifact,experience_lesson_4_2:saved}}})
 render(<PhaseTwoExperienceDesignPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Small complete sample/)).toHaveProperty('value',saved.draft.sample))
 expect(screen.getByLabelText(/Saved 4.1 offer/)).toHaveProperty('value',saved.draft.offerContext)
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
})
it('supports protected founder copy without loading or saving learner records',()=>{
 render(<PhaseTwoExperienceDesignPractice approvedAiRequest={request}/>)
 expect(api.load).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Save sample and outline/})).toBeNull()
 const e=JSON.parse((screen.getByLabelText('Lesson 4.2 experience record') as HTMLTextAreaElement).value)
 expect(e.scenario_establishes_audience_usefulness).toBe(false);expect(e.saved_record_grants_publication_permission).toBe(false)
})
