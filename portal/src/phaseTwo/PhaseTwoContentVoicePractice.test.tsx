import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoContentVoicePractice } from './PhaseTwoContentVoicePractice'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
const request='Draft this sample using only approved sources and the supplied voice. Flag claims requiring verification. Suggest reflective questions that preserve user choice and stay within scope. Brief: [inputs].'
const record={project_path:'B',project_title:'Existing service guide',sections:{digital_delivery_artifact:{offer_lesson_4_1:{scope:'No quote approval'},experience_lesson_4_2:{complete_sample:'Saved estimate sample',experience_outline:{practice:'Calculate and check'},open_assumptions:'Actual audience usefulness untested',scenario_establishes_audience_usefulness:false}}}}
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue(record);api.save.mockResolvedValue({saved_version:17})})
const saveButton=()=>screen.getByRole('button',{name:/Save content and evidence/})
function complete(container:HTMLElement){
 container.querySelectorAll('textarea').forEach(x=>{if(!x.readOnly)fireEvent.change(x,{target:{value:'Checked revision; $140 fictional subtotal; agency retained; unresolved real-use approval.'}})})
 fireEvent.click(screen.getByRole('checkbox'))
}
it('continues the 4.2 sample and retains its evidence labels',async()=>{
 render(<PhaseTwoContentVoicePractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Saved 4.2 sample/)).toHaveProperty('value',expect.stringContaining('Saved estimate sample')))
 expect(screen.getByLabelText(/Saved 4.2 sample/)).toHaveProperty('value',expect.stringContaining('Actual audience usefulness untested'))
 expect(screen.getByLabelText(/Continuing project/)).toHaveProperty('value',expect.stringContaining('Path B'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('saves only the new content section with claim evidence, agency and human release decision',async()=>{
 const {container}=render(<PhaseTwoContentVoicePractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save content and evidence/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
 const input=api.save.mock.calls[0][0];expect(input.path).toBe('B');expect(input.title).toBe(record.project_title)
 expect(Object.keys(input.patch)).toEqual(['digital_delivery_artifact'])
 expect(Object.keys(input.patch.digital_delivery_artifact)).toEqual(['content_voice_lesson_4_3'])
 const e=input.patch.digital_delivery_artifact.content_voice_lesson_4_3
 expect(e.content_workflow).toEqual(['direct','generate','examine','revise','verify','release'])
 expect(Object.keys(e.review_marks)).toEqual(['keep','remove','verify','rewrite'])
 expect(e.revised_sample).toBe(e.draft.revisedSample);expect(e.independent_claim_evidence).toBe(e.draft.claimEvidence)
 expect(e.source_permissions_and_attribution).toBe(e.draft.permissions)
 expect(e.applied_check.factual_correction).toBe(e.draft.factualCorrection);expect(e.applied_check.voice_improvement).toBe(e.draft.voiceImprovement)
 expect(e.agency.qualified_authority_distinction).toBe(e.draft.authorityDistinction);expect(e.release_decision).toBe(e.draft.releaseDecision)
 expect(e.scenario_establishes_audience_usefulness).toBe(false);expect(e.saved_record_grants_publication_permission).toBe(false)
 expect(e.ai_request).toContain('approved sources');expect(e.ai_request).not.toContain('[inputs]')
 expect(screen.getByRole('status').textContent).toContain('Version 17')
})
it('requires all evidence and fresh human review after editing',async()=>{
 const {container}=render(<PhaseTwoContentVoicePractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save content and evidence/});complete(container)
 fireEvent.change(screen.getByLabelText(/Revised explanation/),{target:{value:'Edited'}})
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false);expect(saveButton()).toHaveProperty('disabled',true)
 fireEvent.click(screen.getByRole('checkbox'));expect(saveButton()).toHaveProperty('disabled',false)
 fireEvent.change(screen.getByLabelText(/Independent material-claim/),{target:{value:''}});fireEvent.click(screen.getByRole('checkbox'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('retains answers after save failure and restores the saved 4.3 draft before previous context',async()=>{
 api.save.mockRejectedValue(new Error('Unavailable'))
 const {container,unmount}=render(<PhaseTwoContentVoicePractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save content and evidence/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
 const saved=api.save.mock.calls[0][0].patch.digital_delivery_artifact.content_voice_lesson_4_3
 expect(screen.getByLabelText(/Revised explanation/)).toHaveProperty('value',saved.draft.revisedSample)
 unmount();api.load.mockResolvedValue({...record,sections:{digital_delivery_artifact:{...record.sections.digital_delivery_artifact,content_voice_lesson_4_3:saved}}})
 render(<PhaseTwoContentVoicePractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Revised explanation/)).toHaveProperty('value',saved.draft.revisedSample))
 expect(screen.getByLabelText(/Saved 4.2 sample/)).toHaveProperty('value',saved.draft.savedSample)
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
})
it('supports Path A while keeping the existing project title',async()=>{
 api.load.mockResolvedValue({...record,project_path:'A'})
 const {container}=render(<PhaseTwoContentVoicePractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save content and evidence/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce());expect(api.save.mock.calls[0][0].path).toBe('A');expect(api.save.mock.calls[0][0].title).toBe(record.project_title)
})
it('supports protected owner copy without loading or saving learner records',()=>{
 render(<PhaseTwoContentVoicePractice approvedAiRequest={request}/>)
 expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Save content and evidence/})).toBeNull()
 const e=JSON.parse((screen.getByLabelText('Lesson 4.3 content record') as HTMLTextAreaElement).value)
 expect(e.scenario_establishes_audience_usefulness).toBe(false);expect(e.saved_record_grants_publication_permission).toBe(false)
})
