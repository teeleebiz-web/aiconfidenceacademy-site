import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoReadinessPractice } from './PhaseTwoReadinessPractice'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
const request='Design a resource. Inputs: [brief].'
const record={project_path:'A',project_title:'Continuing project',sections:{leadership_and_adoption_plan:{change_message_lesson_3_3:{final_message:'Reviewed fictional invitation',approval_status:'pending_human_review',draft:{open:'Policy question unresolved',responsible:'Proposed reviewer'}}}}}
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue(record);api.save.mockResolvedValue({saved_version:12})})
function complete(container:HTMLElement){container.querySelectorAll('textarea').forEach(x=>{if(!x.readOnly)fireEvent.change(x,{target:{value:'Checked fictional evidence and pending policy'}})});fireEvent.click(screen.getByRole('checkbox'))}
it('carries pending approval without inventing readiness',async()=>{
 render(<PhaseTwoReadinessPractice enrollmentId="existing" approvedAiRequest={request}/> )
 await waitFor(()=>expect(screen.getByLabelText(/Change-message carry-forward/)).toHaveProperty('value',expect.stringContaining('Policy question unresolved')))
 expect(screen.getByLabelText(/Change-message carry-forward/)).toHaveProperty('value',expect.stringContaining('pending_human_review'))
 expect(screen.getByLabelText('purpose — readiness judgment')).toHaveProperty('value','unclear')
 expect(screen.getByLabelText('purpose — evidence and limits')).toHaveProperty('value','')
 expect(screen.getByRole('button',{name:/Save readiness resource/})).toHaveProperty('disabled',true)
})
it('saves only this lesson with five areas and simulation evidence',async()=>{
 const {container}=render(<PhaseTwoReadinessPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save readiness resource/});complete(container)
 fireEvent.change(screen.getByLabelText('Test evidence type'),{target:{value:'simulation'}})
 fireEvent.click(screen.getByRole('button',{name:/Save readiness resource/}))
 await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
 const input=api.save.mock.calls[0][0]
 expect(input.path).toBe('A');expect(Object.keys(input.patch)).toEqual(['leadership_and_adoption_plan'])
 expect(Object.keys(input.patch.leadership_and_adoption_plan)).toEqual(['readiness_lesson_3_4'])
 const saved=input.patch.leadership_and_adoption_plan.readiness_lesson_3_4
 expect(Object.keys(saved.readiness_view)).toEqual(['purpose','people','process','support','responsibility'])
 expect(saved.test_type).toBe('simulation');expect(saved.practice_only_not_pilot_authorization).toBe(true)
 expect(saved.ai_request).not.toContain('[brief]');expect(screen.getByRole('status').textContent).toContain('Version 12')
})
it('requires the alternative and retains answers on failed save',async()=>{
 api.save.mockRejectedValue(new Error('Unavailable'))
 const {container}=render(<PhaseTwoReadinessPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await screen.findByRole('button',{name:/Save readiness resource/});complete(container)
 const alternative=screen.getByLabelText(/Accessible alternative —/)
 fireEvent.change(alternative,{target:{value:''}})
 expect(screen.getByRole('button',{name:/Save readiness resource/})).toHaveProperty('disabled',true)
 fireEvent.change(alternative,{target:{value:'Written source, draft, task and same criterion'}})
 fireEvent.click(screen.getByRole('button',{name:/Save readiness resource/}))
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
 expect(alternative).toHaveProperty('value','Written source, draft, task and same criterion')
})
it('restores saved readiness without treating saved review as fresh review',async()=>{
 api.load.mockResolvedValue({...record,sections:{leadership_and_adoption_plan:{readiness_lesson_3_4:{draft:{context:'Saved task'},readiness_view:{process:{judgment:'developing',evidence:'Input selection not demonstrated',gap:'Policy example needed'}},test_type:'simulation'}}}})
 render(<PhaseTwoReadinessPractice enrollmentId="existing" approvedAiRequest={request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/Continuing project and one/)).toHaveProperty('value','Saved task'))
 expect(screen.getByLabelText('process — readiness judgment')).toHaveProperty('value','developing')
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
})
it('provides owner copy without creating or saving learner work',()=>{
 render(<PhaseTwoReadinessPractice approvedAiRequest={request}/>)
 expect(api.load).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Save readiness resource/})).toBeNull()
 const r=JSON.parse((screen.getByLabelText('Lesson 3.4 readiness record') as HTMLTextAreaElement).value)
 expect(r.test_type).toBe('self_test');expect(r.practice_only_not_pilot_authorization).toBe(true)
})
