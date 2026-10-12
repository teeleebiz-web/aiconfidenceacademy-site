import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoOfferPractice } from './PhaseTwoOfferPractice'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
const request='Organize this evidenced need into Audience, Need, Value, Content or Service, Format, Responsibility and Limits. Flag unsupported promises. Keep the offer practical for the stated capacity. Inputs: [brief].'
const record={project_path:'A',project_title:'Existing planning project',sections:{professional_ai_operating_model:{audience_need_lesson_1_2:{selected_need:{person:'Internal coordinator',need:'Weekly planning'},evidence_type:'reported',unknown:'Audience test pending'}},leadership_and_adoption_plan:{adoption_rehearsal_lesson_3_6:{decision:'pause',permission_status:'pending_simulated',draft:{dependencies:'Approved access unresolved'}}}}}
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue(record);api.save.mockResolvedValue({saved_version:15})})
const saveButton=()=>screen.getByRole('button',{name:/Save offer and scope/})
function complete(container:HTMLElement){
 container.querySelectorAll('textarea').forEach(x=>{if(!x.readOnly)fireEvent.change(x,{target:{value:'Checked supplied deliverable; audience test pending; no income guarantee.'}})})
 fireEvent.click(screen.getByRole('checkbox'))
}
it('carries the earlier audience need and adoption dependency with their labels',async()=>{
 render(<PhaseTwoOfferPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Journey 1 audience/)).toHaveProperty('value',expect.stringContaining('Internal coordinator')))
 expect(screen.getByLabelText(/Journey 1 audience/)).toHaveProperty('value',expect.stringContaining('reported'))
 expect(screen.getByLabelText(/Journey 3 retained/)).toHaveProperty('value',expect.stringContaining('pending_simulated'))
 expect(screen.getByLabelText(/Journey 3 retained/)).toHaveProperty('value',expect.stringContaining('Approved access unresolved'))
 expect(screen.getByLabelText(/Continuing project and/)).toHaveProperty('value',expect.stringContaining('Path A'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('saves only the offer section with the frame, three formats, scope and open assumptions',async()=>{
 const {container}=render(<PhaseTwoOfferPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save offer and scope/});complete(container)
 expect(saveButton()).toHaveProperty('disabled',false);fireEvent.click(saveButton())
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
 const input=api.save.mock.calls[0][0];expect(input.path).toBe('A')
 expect(Object.keys(input.patch)).toEqual(['digital_delivery_artifact'])
 expect(Object.keys(input.patch.digital_delivery_artifact)).toEqual(['offer_lesson_4_1'])
 const e=input.patch.digital_delivery_artifact.offer_lesson_4_1
 expect(Object.keys(e.responsible_offer_frame)).toHaveLength(7)
 expect(e.format_comparison.simpler).toContain('audience test pending')
 expect(e.scope.user_responsibility).toBe(e.draft.userResponsibility)
 expect(e.unsupported_guarantee_correction).toBe(e.draft.guaranteeCorrection)
 expect(e.saved_draft_establishes_demand).toBe(false);expect(e.saved_record_grants_publication_permission).toBe(false)
 expect(e.ai_request).toContain('Flag unsupported promises');expect(e.ai_request).not.toContain('[brief]')
 expect(screen.getByRole('status').textContent).toContain('Version 15')
})
it('requires a fresh promise review after changing the scope and complete fields',async()=>{
 const {container}=render(<PhaseTwoOfferPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save offer and scope/});complete(container)
 fireEvent.change(screen.getByLabelText(/Exclusion list/),{target:{value:'Revised exclusions'}})
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false);expect(saveButton()).toHaveProperty('disabled',true)
 fireEvent.click(screen.getByRole('checkbox'));expect(saveButton()).toHaveProperty('disabled',false)
 fireEvent.change(screen.getByLabelText(/Simpler alternative/),{target:{value:''}});fireEvent.click(screen.getByRole('checkbox'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('keeps answers after failed saving and restores the saved draft before earlier prefill',async()=>{
 api.save.mockRejectedValue(new Error('Unavailable'))
 const {container,unmount}=render(<PhaseTwoOfferPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save offer and scope/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
 const saved=api.save.mock.calls[0][0].patch.digital_delivery_artifact.offer_lesson_4_1
 expect(screen.getByLabelText(/My bounded offer sentence/)).toHaveProperty('value',saved.draft.offerSentence)
 unmount();api.load.mockResolvedValue({...record,sections:{digital_delivery_artifact:{offer_lesson_4_1:saved}}})
 render(<PhaseTwoOfferPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/My bounded offer sentence/)).toHaveProperty('value',saved.draft.offerSentence))
 expect(screen.getByLabelText(/Journey 1 audience/)).toHaveProperty('value',saved.draft.audienceEvidence)
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
})
it('allows founder copy without loading or saving learner records',()=>{
 render(<PhaseTwoOfferPractice approvedAiRequest={request}/>)
 expect(api.load).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Save offer and scope/})).toBeNull()
 const e=JSON.parse((screen.getByLabelText('Lesson 4.1 offer record') as HTMLTextAreaElement).value)
 expect(e.saved_draft_establishes_demand).toBe(false);expect(e.saved_record_grants_publication_permission).toBe(false)
})
