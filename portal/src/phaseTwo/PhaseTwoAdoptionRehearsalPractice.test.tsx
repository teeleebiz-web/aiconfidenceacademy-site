import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoAdoptionRehearsalPractice } from './PhaseTwoAdoptionRehearsalPractice'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
const request='Challenge the plan. Ask me to justify the decision before suggesting revisions. Plan: [draft].'
const record={project_path:'A',project_title:'Continuing intake project',sections:{leadership_and_adoption_plan:{
 people_lesson_3_1:{draft:{groups:'Temporary worker has least authority'}},
 listening_lesson_3_2:{evidence_type:'simulated_role_play',represents_real_staff:false},
 change_message_lesson_3_3:{final_message:'Earlier message',approval_status:'pending_human_review'},
 readiness_lesson_3_4:{draft:{actions:'Named reviewer resource'},test_type:'simulation'},
 pilot_lesson_3_5:{draft:{scope:'Approved invented inputs only',dependencies:'Approved access unresolved'},permission_status:'pending_simulated'}
}}}
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue(record);api.save.mockResolvedValue({saved_version:14})})
const saveButton=()=>screen.getByRole('button',{name:/Save final plan/})
function justify(){
 fireEvent.change(screen.getByLabelText('Adoption decision'),{target:{value:'pause'}})
 fireEvent.change(screen.getByLabelText(/My decision justification/),{target:{value:'Pause because approved access is unresolved; accuracy does not justify account sharing.'}})
 fireEvent.click(screen.getByRole('checkbox',{name:/I recorded my decision/}))
}
function complete(container:HTMLElement){
 justify()
 container.querySelectorAll('textarea').forEach(x=>{if(!x.readOnly&&!x.parentElement?.textContent?.includes('Actual human approval reference')&&!x.parentElement?.textContent?.includes('Authorized human feedback')&&!x.parentElement?.textContent?.includes('My decision justification'))fireEvent.change(x,{target:{value:'Checked fictional condition; pending access and permission retained.'}})})
 fireEvent.click(screen.getByRole('checkbox',{name:/I checked evidence labels/}))
}
it('carries all five artifacts with evidence and approval labels intact',async()=>{
 render(<PhaseTwoAdoptionRehearsalPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/People map and/)).toHaveProperty('value',expect.stringContaining('Temporary worker')))
 expect(screen.getByLabelText(/Listening evidence/)).toHaveProperty('value',expect.stringContaining('simulated_role_play'))
 expect(screen.getByLabelText(/Earlier change message/)).toHaveProperty('value',expect.stringContaining('pending_human_review'))
 expect(screen.getByLabelText(/Earlier readiness support/)).toHaveProperty('value',expect.stringContaining('simulation'))
 expect(screen.getByLabelText(/Earlier pilot design/)).toHaveProperty('value',expect.stringContaining('pending_simulated'))
 expect(screen.getByLabelText('Adoption-plan AI challenge request')).toHaveProperty('value',expect.stringContaining('Ask me to justify'))
 expect(saveButton()).toHaveProperty('disabled',true)
})
it('requires the decision justification before opening the revision step',()=>{
 render(<PhaseTwoAdoptionRehearsalPractice approvedAiRequest={request}/>)
 expect(screen.queryByLabelText(/Final retained Leadership/)).toBeNull()
 expect(screen.getByRole('checkbox',{name:/I recorded my decision/})).toHaveProperty('disabled',true)
 justify();expect(screen.getByLabelText(/Final retained Leadership/)).toBeTruthy()
 fireEvent.change(screen.getByLabelText(/My decision justification/),{target:{value:'Reconsidered decision'}})
 expect(screen.queryByLabelText(/Final retained Leadership/)).toBeNull()
})
it('saves final artifacts and rationale only in the new integration section',async()=>{
 const {container}=render(<PhaseTwoAdoptionRehearsalPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save final plan/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
 const input=api.save.mock.calls[0][0];expect(input.path).toBe('A')
 expect(Object.keys(input.patch)).toEqual(['leadership_and_adoption_plan'])
 expect(Object.keys(input.patch.leadership_and_adoption_plan)).toEqual(['adoption_rehearsal_lesson_3_6'])
 const e=input.patch.leadership_and_adoption_plan.adoption_rehearsal_lesson_3_6
 expect(e.decision).toBe('pause');expect(e.permission_status).toBe('pending_simulated');expect(e.approval_reference).toBeNull()
 expect(e.simulated_reactions_establish_acceptance).toBe(false);expect(e.record_grants_permission).toBe(false)
 expect(e.final_leadership_and_adoption_plan).toBe(e.draft.finalPlan);expect(e.final_communication).toBe(e.draft.finalCommunication);expect(e.final_training_resource).toBe(e.draft.finalResource)
 expect(e.revision_rationale).toBe(e.draft.decisionNote);expect(screen.getByRole('status').textContent).toContain('Version 14')
})
it.each(['proceed_with_permission','limited_test'])('blocks a real %s until approval, access and blockers are addressed',async decision=>{
 const {container}=render(<PhaseTwoAdoptionRehearsalPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save final plan/});complete(container)
 fireEvent.change(screen.getByLabelText('Adoption decision'),{target:{value:decision}})
 fireEvent.click(screen.getByRole('checkbox',{name:/I recorded my decision/}))
 expect(saveButton()).toHaveProperty('disabled',true)
 fireEvent.change(screen.getByLabelText('Pilot authorization status'),{target:{value:'authorized_reported_by_learner'}})
 fireEvent.change(screen.getByLabelText(/Actual human approval reference/),{target:{value:'Actual manager scope reference reported by learner'}})
 expect(saveButton()).toHaveProperty('disabled',true)
 fireEvent.change(screen.getByLabelText('Approved participant access'),{target:{value:'verified_reported_by_learner'}})
 expect(saveButton()).toHaveProperty('disabled',true)
 fireEvent.change(screen.getByLabelText('Blocking conditions'),{target:{value:'resolved_reported_by_learner'}})
 fireEvent.click(screen.getByRole('checkbox',{name:/I checked evidence labels/}))
 expect(saveButton()).toHaveProperty('disabled',false)
})
it('requires retained human feedback when human or mixed evidence is reported',async()=>{
 const {container}=render(<PhaseTwoAdoptionRehearsalPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save final plan/});complete(container)
 fireEvent.change(screen.getByLabelText('Feedback source'),{target:{value:'mixed'}});expect(saveButton()).toHaveProperty('disabled',true)
 fireEvent.change(screen.getByLabelText(/Authorized human feedback —/),{target:{value:'Authorized participant reported an access barrier; simulated recipient reaction retained separately.'}})
 fireEvent.click(screen.getByRole('checkbox',{name:/I checked evidence labels/}))
 expect(saveButton()).toHaveProperty('disabled',false)
})
it('retains answers after a save failure and restores saved work with fresh checks',async()=>{
 api.save.mockRejectedValue(new Error('Unavailable'))
 const {container,unmount}=render(<PhaseTwoAdoptionRehearsalPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save final plan/});complete(container);fireEvent.click(saveButton())
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
 expect(screen.getByLabelText(/Final retained Leadership/)).toHaveProperty('value',expect.stringContaining('pending access'))
 const saved=api.save.mock.calls[0][0].patch.leadership_and_adoption_plan.adoption_rehearsal_lesson_3_6
 unmount();api.load.mockResolvedValue({...record,sections:{leadership_and_adoption_plan:{adoption_rehearsal_lesson_3_6:saved}}})
 render(<PhaseTwoAdoptionRehearsalPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText('Adoption decision')).toHaveProperty('value','pause'))
 expect(screen.getByRole('checkbox',{name:/I recorded my decision/})).toHaveProperty('checked',false)
 fireEvent.click(screen.getByRole('checkbox',{name:/I recorded my decision/}))
 expect(screen.getByRole('checkbox',{name:/I checked evidence labels/})).toHaveProperty('checked',false)
 expect(screen.getByLabelText(/Final retained Leadership/)).toHaveProperty('value',saved.draft.finalPlan)
})
it('supports founder copy without loading or writing learner records',()=>{
 render(<PhaseTwoAdoptionRehearsalPractice approvedAiRequest={request}/>)
 expect(api.load).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Save final plan/})).toBeNull()
 const e=JSON.parse((screen.getByLabelText('Lesson 3.6 adoption record') as HTMLTextAreaElement).value)
 expect(e.record_grants_permission).toBe(false);expect(e.simulated_reactions_establish_acceptance).toBe(false)
})
