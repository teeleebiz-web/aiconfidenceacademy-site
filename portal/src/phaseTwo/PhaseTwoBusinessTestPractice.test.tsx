import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoBusinessTestPractice } from './PhaseTwoBusinessTestPractice'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
const request='Organize this test and cost model. Separate observed feedback from assumptions, show calculations using only supplied figures and identify missing costs. Do not infer willingness to pay from simulated responses. Inputs: [notes].'
const record={project_path:'B',project_title:'Existing service guide',sections:{digital_delivery_artifact:{offer_lesson_4_1:{scope:'No quote approval'},delivery_lesson_4_4:{corrected_instructions:'Retained human-owned access route'},content_voice_lesson_4_3:{revised_sample:'Saved estimate sample',experience_outline:{practice:'Calculate and check'},open_assumptions:'Actual audience usefulness untested',scenario_establishes_audience_usefulness:false}}}}
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue(record);api.save.mockResolvedValue({saved_version:17})})
const saveButton=()=>screen.getByRole('button',{name:/Save test plan and cost review/})
function complete(container:HTMLElement){
 container.querySelectorAll('textarea').forEach(x=>{if(!x.readOnly)fireEvent.change(x,{target:{value:'Checked revision; $140 fictional subtotal; agency retained; unresolved real-use approval.'}})})
 fireEvent.click(screen.getByRole('checkbox'))
}
it('continues the 4.2 sample and retains its evidence labels',async()=>{
 render(<PhaseTwoBusinessTestPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Saved offer, sample/)).toHaveProperty('value',expect.stringContaining('Saved estimate sample')))
 expect(screen.getByLabelText(/Saved offer, sample/)).toHaveProperty('value',expect.stringContaining('Actual audience usefulness untested'))
 expect(screen.getByLabelText(/Saved offer, sample/)).toHaveProperty('value',expect.stringContaining('Retained human-owned access route'))
 expect(screen.getByLabelText(/Continuing project/)).toHaveProperty('value',expect.stringContaining('Path B'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('saves only the new content section with claim evidence, agency and human release decision',async()=>{
 const {container}=render(<PhaseTwoBusinessTestPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save test plan and cost review/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
 const input=api.save.mock.calls[0][0];expect(input.path).toBe('B');expect(input.title).toBe(record.project_title)
 expect(Object.keys(input.patch)).toEqual(['digital_delivery_artifact'])
 expect(Object.keys(input.patch.digital_delivery_artifact)).toEqual(['business_test_lesson_4_5'])
 const e=input.patch.digital_delivery_artifact.business_test_lesson_4_5
 expect(e.test_and_cost_notes.responsible_business_review_criteria).toEqual(['useful','clear','deliverable','responsible','sustainable','testable'])
 expect(e.applied_check.revision_evidence).toBe(e.draft.revisionEvidence)
 expect(e.applied_check.hidden_cost).toBe(e.draft.hiddenCost)
 expect(e.applied_check.unestablished_claim).toBe(e.draft.unestablishedClaim)
 expect(e.human_review_decision).toBe(e.draft.reviewDecision)
 expect(e.simulated_feedback_establishes_willingness_to_pay).toBe(false)
 expect(e.scenario_validates_demand).toBe(false);expect(e.cost_model_guarantees_commercial_return).toBe(false)
 expect(e.saved_record_grants_publication_permission).toBe(false)
 expect(e.ai_request).toContain('Do not infer willingness to pay from simulated responses');expect(e.ai_request).not.toContain('[notes]')
 expect(screen.getByRole('status').textContent).toContain('Version 17')
})
it('requires all evidence and fresh human review after editing',async()=>{
 const {container}=render(<PhaseTwoBusinessTestPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save test plan and cost review/});complete(container)
 fireEvent.change(screen.getByLabelText(/Evidence that would justify/),{target:{value:'Edited'}})
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false);expect(saveButton()).toHaveProperty('disabled',true)
 fireEvent.click(screen.getByRole('checkbox'));expect(saveButton()).toHaveProperty('disabled',false)
 fireEvent.change(screen.getByLabelText(/Missing costs/),{target:{value:''}});fireEvent.click(screen.getByRole('checkbox'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('retains answers after save failure and restores the saved 4.5 draft before previous context',async()=>{
 api.save.mockRejectedValue(new Error('Unavailable'))
 const {container,unmount}=render(<PhaseTwoBusinessTestPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save test plan and cost review/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
 const saved=api.save.mock.calls[0][0].patch.digital_delivery_artifact.business_test_lesson_4_5
 expect(screen.getByLabelText(/Evidence that would justify/)).toHaveProperty('value',saved.draft.revisionEvidence)
 unmount();api.load.mockResolvedValue({...record,sections:{digital_delivery_artifact:{...record.sections.digital_delivery_artifact,business_test_lesson_4_5:saved}}})
 render(<PhaseTwoBusinessTestPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Evidence that would justify/)).toHaveProperty('value',saved.draft.revisionEvidence))
 expect(screen.getByLabelText(/Saved offer, sample/)).toHaveProperty('value',saved.draft.savedArtifact)
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
})
it('supports Path A while keeping the existing project title',async()=>{
 api.load.mockResolvedValue({...record,project_path:'A'})
 const {container}=render(<PhaseTwoBusinessTestPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save test plan and cost review/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce());expect(api.save.mock.calls[0][0].path).toBe('A');expect(api.save.mock.calls[0][0].title).toBe(record.project_title)
})
it('supports protected owner copy without loading or saving learner records',()=>{
 render(<PhaseTwoBusinessTestPractice approvedAiRequest={request}/>)
 expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Save test plan and cost review/})).toBeNull()
 const e=JSON.parse((screen.getByLabelText('Lesson 4.5 test and cost record') as HTMLTextAreaElement).value)
 expect(e.scenario_validates_demand).toBe(false);expect(e.saved_record_grants_publication_permission).toBe(false)
})
