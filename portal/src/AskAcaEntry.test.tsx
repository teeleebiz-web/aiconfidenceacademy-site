import {act,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {AskAcaEntry} from './AskAcaEntry'
import {askAcaReturnKey} from './askAcaRoute'
import {controlCenterReturnKey} from './controlCenterRoute'
const api=vi.hoisted(()=>({getSession:vi.fn(),otp:vi.fn(),password:vi.fn(),from:vi.fn(),rpc:vi.fn(),changed:null as null|((event:string,session:unknown)=>void)}))
vi.mock('./lib/supabase',()=>({supabase:{auth:{getSession:api.getSession,signInWithOtp:api.otp,signInWithPassword:api.password,onAuthStateChange:(callback:typeof api.changed)=>{api.changed=callback;return {data:{subscription:{unsubscribe:()=>{}}}}}},from:api.from,rpc:api.rpc}}))
beforeEach(()=>{
 vi.clearAllMocks();api.getSession.mockResolvedValue({data:{session:null},error:null});api.otp.mockResolvedValue({error:null});api.password.mockResolvedValue({error:null})
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({enabled:false})}))
})
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear()})
it('shows the Ask ACA sign-in destination without reading records or requesting model access',async()=>{
 render(<AskAcaEntry/>);expect(await screen.findByRole('heading',{name:'Ask ACA',level:1})).toBeTruthy()
 expect(screen.queryByLabelText('Your question')).toBeNull();expect(api.from).not.toHaveBeenCalled();expect(api.rpc).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
})
it('answers immediately for an existing session without reading enrollment or starting a lesson',async()=>{
 api.getSession.mockResolvedValue({data:{session:{user:{id:'fixture'},access_token:'fixture-token'}},error:null})
 render(<AskAcaEntry/>);const field=await screen.findByLabelText('Your question')
 fireEvent.change(field,{target:{value:'How do I verify an answer?'}});fireEvent.click(screen.getByRole('button',{name:'Find guidance'}))
 expect(screen.getByText('Check an AI answer before using it')).toBeTruthy()
 expect(api.from).not.toHaveBeenCalled();expect(api.rpc).not.toHaveBeenCalled()
 expect(vi.mocked(fetch).mock.calls.every(([,options])=>!options?.method||options.method==='GET')).toBe(true)
 await act(async()=>api.changed?.('SIGNED_OUT',null));expect(screen.queryByLabelText('Your question')).toBeNull()
})
it('uses the existing email callback with an Ask ACA return hint only after the learner submits',async()=>{
 localStorage.setItem(controlCenterReturnKey,String(Date.now()+600000))
 render(<AskAcaEntry/>);const field=await screen.findByLabelText('Enrollment email')
 expect(api.otp).not.toHaveBeenCalled()
 fireEvent.change(field,{target:{value:'fixture@example.com'}});fireEvent.click(screen.getByRole('button',{name:'Send my sign-in link'}))
 await waitFor(()=>expect(api.otp).toHaveBeenCalledWith({email:'fixture@example.com',options:{shouldCreateUser:false,emailRedirectTo:location.origin+'/learn/'}}))
 expect(Number(localStorage.getItem(askAcaReturnKey))).toBeGreaterThan(Date.now());expect(localStorage.getItem(controlCenterReturnKey)).toBeNull()
 expect(await screen.findByText(/return to Ask ACA/)).toBeTruthy()
})
it('keeps a newer auth event when an older session lookup completes later',async()=>{
 let resolve!:(value:unknown)=>void;api.getSession.mockImplementation(()=>new Promise(r=>{resolve=r}))
 render(<AskAcaEntry/>);await act(async()=>api.changed?.('SIGNED_IN',{user:{id:'fixture'},access_token:'fixture-token'}))
 await screen.findByLabelText('Your question');await act(async()=>resolve({data:{session:null},error:null}))
 expect(screen.getByLabelText('Your question')).toBeTruthy()
})
