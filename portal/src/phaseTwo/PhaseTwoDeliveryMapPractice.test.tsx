import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoDeliveryMapPractice } from './PhaseTwoDeliveryMapPractice'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
const request="Review this customer and participant flow for missing information, support, access, feedback, completion and human ownership. Flag confusing or manipulative steps. Do not create payment or platform settings. Flow: [draft]."
const record={project_path:'B',project_title:'Existing service guide',sections:{digital_delivery_artifact:{offer_lesson_4_1:{scope:'No quote approval'},content_voice_lesson_4_3:{revised_sample:'Saved estimate sample',experience_outline:{practice:'Calculate and check'},open_assumptions:'Actual audience usefulness untested',scenario_establishes_audience_usefulness:false}}}}
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue(record);api.save.mockResolvedValue({saved_version:17})})
const saveButton=()=>screen.getByRole('button',{name:/Save delivery map and corrections/})
function complete(container:HTMLElement){
 container.querySelectorAll('textarea').forEach(x=>{if(!x.readOnly)fireEvent.change(x,{target:{value:'Checked revision; $140 fictional subtotal; agency retained; unresolved real-use approval.'}})})
 fireEvent.click(screen.getByRole('checkbox'))
}
it('continues the 4.2 sample and retains its evidence labels',async()=>{
 render(<PhaseTwoDeliveryMapPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Saved offer, 4.2/)).toHaveProperty('value',expect.stringContaining('Saved estimate sample')))
 expect(screen.getByLabelText(/Saved offer, 4.2/)).toHaveProperty('value',expect.stringContaining('Actual audience usefulness untested'))
 expect(screen.getByLabelText(/Continuing project/)).toHaveProperty('value',expect.stringContaining('Path B'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('saves only the new content section with claim evidence, agency and human release decision',async()=>{
 const {container}=render(<PhaseTwoDeliveryMapPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save delivery map and corrections/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
 const input=api.save.mock.calls[0][0];expect(input.path).toBe('B');expect(input.title).toBe(record.project_title)
 expect(Object.keys(input.patch)).toEqual(['digital_delivery_artifact'])
 expect(Object.keys(input.patch.digital_delivery_artifact)).toEqual(['delivery_lesson_4_4'])
 const e=input.patch.digital_delivery_artifact.delivery_lesson_4_4
 expect(e.connected_delivery_map.outer_flow.map((x:{stage:string})=>x.stage)).toEqual(['discover','understand','choose','receive','begin','participate','support','complete','follow-up'])
 expect(e.connected_delivery_map.participation_map.map((x:{stage:string})=>x.stage)).toEqual(['enter','orient','engage','respond','review','support','complete','continue'])
 expect(e.connected_delivery_map.connections).toHaveLength(6)
 expect(e.corrected_instructions).toBe(e.draft.failureCorrections)
 expect(e.applied_check.discovery_to_follow_up_trace_help_and_access_failure).toBe(e.draft.traceDecision)
 expect(e.scenario_establishes_live_delivery_or_customer_satisfaction).toBe(false)
 expect(e.payment_or_platform_settings_created).toBe(false);expect(e.saved_record_grants_publication_permission).toBe(false)
 expect(e.ai_request).toContain('Do not create payment or platform settings');expect(e.ai_request).not.toContain('[draft]')
 expect(screen.getByRole('status').textContent).toContain('Version 17')
})
it('requires all evidence and fresh human review after editing',async()=>{
 const {container}=render(<PhaseTwoDeliveryMapPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save delivery map and corrections/});complete(container)
 fireEvent.change(screen.getByLabelText(/Two failure points/),{target:{value:'Edited'}})
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false);expect(saveButton()).toHaveProperty('disabled',true)
 fireEvent.click(screen.getByRole('checkbox'));expect(saveButton()).toHaveProperty('disabled',false)
 fireEvent.change(screen.getByLabelText(/Policy, delivery/),{target:{value:''}});fireEvent.click(screen.getByRole('checkbox'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('retains answers after save failure and restores the saved 4.4 draft before previous context',async()=>{
 api.save.mockRejectedValue(new Error('Unavailable'))
 const {container,unmount}=render(<PhaseTwoDeliveryMapPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save delivery map and corrections/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
 const saved=api.save.mock.calls[0][0].patch.digital_delivery_artifact.delivery_lesson_4_4
 expect(screen.getByLabelText(/Two failure points/)).toHaveProperty('value',saved.draft.failureCorrections)
 unmount();api.load.mockResolvedValue({...record,sections:{digital_delivery_artifact:{...record.sections.digital_delivery_artifact,delivery_lesson_4_4:saved}}})
 render(<PhaseTwoDeliveryMapPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Two failure points/)).toHaveProperty('value',saved.draft.failureCorrections))
 expect(screen.getByLabelText(/Saved offer, 4.2/)).toHaveProperty('value',saved.draft.savedArtifact)
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
})
it('supports Path A while keeping the existing project title',async()=>{
 api.load.mockResolvedValue({...record,project_path:'A'})
 const {container}=render(<PhaseTwoDeliveryMapPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save delivery map and corrections/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce());expect(api.save.mock.calls[0][0].path).toBe('A');expect(api.save.mock.calls[0][0].title).toBe(record.project_title)
})
it('supports protected owner copy without loading or saving learner records',()=>{
 render(<PhaseTwoDeliveryMapPractice approvedAiRequest={request}/>)
 expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Save delivery map and corrections/})).toBeNull()
 const e=JSON.parse((screen.getByLabelText('Lesson 4.4 delivery record') as HTMLTextAreaElement).value)
 expect(e.scenario_establishes_live_delivery_or_customer_satisfaction).toBe(false);expect(e.saved_record_grants_publication_permission).toBe(false)
})
