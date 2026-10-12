import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { PhaseTwoPilotPractice } from './PhaseTwoPilotPractice'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
const request='Review this plan. Do not assume authorization. Plan: [draft].'
const record={project_path:'B',project_title:'Continuing service',sections:{leadership_and_adoption_plan:{readiness_lesson_3_4:{draft:{context:'Draft-only task',actions:'Policy example with reviewer',remaining:'Actual pilot permission unresolved'},test_type:'simulation'},change_message_lesson_3_3:{final_message:'Reviewed message',approval_status:'pending_human_review',draft:{open:'Access question'}}}}}
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue(record);api.save.mockResolvedValue({saved_version:13})})
function complete(container:HTMLElement){container.querySelectorAll('textarea').forEach(x=>{if(!x.readOnly&&!x.parentElement?.textContent?.includes('Actual human approval reference'))fireEvent.change(x,{target:{value:'Checked fictional plan and unresolved permissions'}})});fireEvent.click(screen.getByRole('checkbox'))}
it('carries readiness and message evidence without inventing pilot permission',async()=>{
 render(<PhaseTwoPilotPractice enrollmentId="existing" approvedAiRequest={request}/> )
 await waitFor(()=>expect(screen.getByLabelText(/Readiness support and open/)).toHaveProperty('value',expect.stringContaining('Actual pilot permission unresolved')))
 expect(screen.getByLabelText(/Readiness support and open/)).toHaveProperty('value',expect.stringContaining('simulation'))
 expect(screen.getByLabelText('Pilot authorization status')).toHaveProperty('value','pending_simulated')
 expect(screen.getByLabelText(/Communication — reviewed/)).toHaveProperty('value',expect.stringContaining('pending_human_review'))
 expect(screen.getByRole('button',{name:/Save adoption plan/})).toHaveProperty('disabled',true)
})
it('saves only new plan and GOVERN evidence, keeping unresolved experiment simulated',async()=>{
 const {container}=render(<PhaseTwoPilotPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save adoption plan/});complete(container)
 fireEvent.click(screen.getByRole('button',{name:/Save adoption plan/}))
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
 const input=api.save.mock.calls[0][0]
 expect(input.path).toBe('B');expect(Object.keys(input.patch)).toEqual(['leadership_and_adoption_plan','governance_literacy_evidence'])
 expect(Object.keys(input.patch.leadership_and_adoption_plan)).toEqual(['pilot_lesson_3_5'])
 expect(Object.keys(input.patch.governance_literacy_evidence)).toEqual(['govern_lesson_3_5'])
 const saved=input.patch.leadership_and_adoption_plan.pilot_lesson_3_5
 expect(saved.experiment_remains_simulated).toBe(true);expect(saved.approval_reference).toBeNull()
 expect(Object.keys(saved.govern_view)).toEqual(['goal','owners','values','evidence','rules','notice'])
 expect(saved.ai_request).not.toContain('[draft]');expect(screen.getByRole('status').textContent).toContain('Version 13')
})
it('requires a human reference when authorization is reported and preserves work after failure',async()=>{
 api.save.mockRejectedValue(new Error('Unavailable'))
 const {container}=render(<PhaseTwoPilotPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save adoption plan/});complete(container)
 fireEvent.change(screen.getByLabelText('Pilot authorization status'),{target:{value:'authorized_reported_by_learner'}})
 expect(screen.getByRole('button',{name:/Save adoption plan/})).toHaveProperty('disabled',true)
 fireEvent.change(screen.getByLabelText(/Actual human approval reference/),{target:{value:'Manager reference: approved fictional practice scope only'}})
 fireEvent.click(screen.getByRole('button',{name:/Save adoption plan/}))
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
 expect(screen.getByLabelText(/Actual human approval reference/)).toHaveProperty('value',expect.stringContaining('Manager reference'))
 expect(api.save.mock.calls[0][0].patch.leadership_and_adoption_plan.pilot_lesson_3_5.approval_reference).toContain('Manager reference')
})
it('restores this lesson and requires a fresh human review check',async()=>{
 api.load.mockResolvedValue({...record,sections:{leadership_and_adoption_plan:{pilot_lesson_3_5:{draft:{context:'Saved bounded pilot',testDesign:'Saved design'},permission_status:'pending_simulated'}}}})
 render(<PhaseTwoPilotPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText('Change context and continuing project')).toHaveProperty('value','Saved bounded pilot'))
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
 expect(screen.getByLabelText(/Pilot test design —/)).toHaveProperty('value','Saved design')
})
it('allows owner copy without creating or saving learner data',()=>{
 render(<PhaseTwoPilotPractice approvedAiRequest={request}/>)
 expect(api.load).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Save adoption plan/})).toBeNull()
 const evidence=JSON.parse((screen.getByLabelText('Lesson 3.5 pilot record') as HTMLTextAreaElement).value)
 expect(evidence.experiment_remains_simulated).toBe(true);expect(evidence.learner_report_is_not_a_permission_grant).toBe(true)
})
