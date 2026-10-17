import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {SupportInbox} from './SupportInbox'
afterEach(()=>vi.unstubAllGlobals())
it('requires review before replying to the selected support case',async()=>{
 const id='00000000-0000-4000-8000-000000000001',calls:unknown[]=[]
 vi.stubGlobal('fetch',vi.fn(async(_url:string,o:RequestInit)=>{if(o.method==='POST')calls.push(JSON.parse(o.body as string));return {ok:true,status:200,json:async()=>o.method==='POST'?{ok:true,emailSent:true}:{cases:[{id,name:'Requester',email:'requester@example.test',subject:'Save problem',category:'technical',status:'open'}],messages:[]}}}))
 const user=userEvent.setup();render(<SupportInbox origin="https://aca.example" accessToken="owner"/>);await screen.findByRole('option',{name:/Save problem/});await user.selectOptions(screen.getByLabelText('Choose a case'),id);await user.type(screen.getByLabelText('Reply to requester'),'Please try the documented step.');await user.click(screen.getByRole('button',{name:'Review reply'}));expect(calls).toHaveLength(0);await user.click(screen.getByRole('button',{name:'Send reviewed reply'}));await screen.findByText('Reply saved and email submitted.');expect(calls).toEqual([expect.objectContaining({caseId:id,action:'reply',message:'Please try the documented step.'})])
})
