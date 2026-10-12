import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoCloseoutPractice } from './PhaseTwoCloseoutPractice'
import production from '../../../academy/phase-two-production/J6-L6-6-production.json'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue({project_path:'B',project_title:'Retained intake project',sections:{capstone_integration_package:{artifact_lesson_6_2:{retained:true}},professional_positioning_evidence:{retained:true}}});api.save.mockResolvedValue({saved_version:36})})
it('requires all six journey references and human review, then saves only the existing capstone closeout notes without assigning credentials or delivery',async()=>{
 const {container}=render(<PhaseTwoCloseoutPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request}/>)
 const save=await screen.findByRole('button',{name:'Save Portfolio Closeout and Execution Plan Notes to My Project Record'})
 expect(save).toHaveProperty('disabled',true)
 for(const x of [...container.querySelectorAll('textarea')].filter(x=>!x.readOnly))fireEvent.change(x,{target:{value:'Current retained reference; fictional tabletop. Proposed action requires permission. Receipt not yet confirmed.'}})
 const sixth=screen.getByLabelText(/^Journey Six result/);fireEvent.change(sixth,{target:{value:''}});fireEvent.click(screen.getByRole('checkbox'));expect(save).toHaveProperty('disabled',true)
 fireEvent.change(sixth,{target:{value:'Final bounded artifact and evidence index'}});expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(save);await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
 const input=api.save.mock.calls[0][0];expect(input.path).toBe('B');expect(input.title).toBe('Retained intake project')
 expect(Object.keys(input.patch)).toEqual(['capstone_integration_package']);expect(Object.keys(input.patch.capstone_integration_package)).toEqual(['closeout_lesson_6_6'])
 const e=input.patch.capstone_integration_package.closeout_lesson_6_6
 expect(Object.keys(e.six_journey_index)).toEqual(['1','2','3','4','5','6']);expect(Object.keys(e.execution_plan)).toEqual(['day_30','day_60','day_90'])
 expect(e.ai_request).not.toContain('[inputs]');expect(e.ai_request).toContain('Do not decide certification.')
 expect(e.assigns_certification).toBe(false);expect(e.saving_confirms_delivery).toBe(false);expect(e.human_review_confirmed).toBe(true)
 expect(screen.getByRole('status').textContent).toContain('Version 36')
 expect(screen.getByText(/Saving notes does not send files/)).toBeTruthy()
})
it('restores saved closeout notes without automatic human approval and leaves founder review read-only',async()=>{
 api.load.mockResolvedValue({project_path:'B',project_title:'Existing project',sections:{capstone_integration_package:{closeout_lesson_6_6:{draft:{day90:'Conditional wider use depends on evidence and permission'}}}}})
 const {unmount}=render(<PhaseTwoCloseoutPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request}/>)
 await waitFor(()=>expect(screen.getByLabelText(/^90-day plan/)).toHaveProperty('value','Conditional wider use depends on evidence and permission'))
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',false);unmount();vi.clearAllMocks()
 render(<PhaseTwoCloseoutPractice approvedAiRequest={production.approved_ai_request}/>);expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled()
 expect(screen.getByRole('button',{name:'Copy my Lesson 6.6 record'})).toBeTruthy()
})
