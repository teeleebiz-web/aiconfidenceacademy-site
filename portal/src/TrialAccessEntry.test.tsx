import {StrictMode} from 'react'
import {render,screen,waitFor} from '@testing-library/react'
import {TrialAccessEntry} from './TrialAccessEntry'

const auth=vi.hoisted(()=>({verifyOtp:vi.fn()}))
vi.mock('./lib/supabase',()=>({supabase:{auth}}))
const code='ACA_'+'a'.repeat(64)
beforeEach(()=>{
  window.history.replaceState(null,'',`/learn/?view=trial-access#invite=${code}`)
  auth.verifyOtp.mockReset().mockResolvedValue({data:{session:{user:{id:'assigned-learner'}}},error:null})
})
afterEach(()=>{vi.unstubAllGlobals();window.history.replaceState(null,'','/')})
it('opens the trial without asking for an email or password or sending another message',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({token_hash:'synthetic-auth-token',type:'invite',learner_id:'assigned-learner',phase:1})}),enter=vi.fn()
  vi.stubGlobal('fetch',fetcher)
  render(<StrictMode><TrialAccessEntry onEnter={enter}/></StrictMode>)
  await waitFor(()=>expect(enter).toHaveBeenCalledWith('/learn/'))
  expect(enter).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toContain('/api/trials/accept')
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({code});expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({token_hash:'synthetic-auth-token',type:'invite'})
  expect(screen.queryByRole('textbox')).toBeNull();expect(screen.queryByText(/password/i)).toBeNull();expect(window.location.hash).toBe('')
})
it('uses the stored phase destination only after the authenticated identity is verified',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({token_hash:'synthetic-auth-token',type:'magiclink',learner_id:'assigned-learner',phase:2})}));const enter=vi.fn()
  render(<TrialAccessEntry onEnter={enter}/>);await waitFor(()=>expect(enter).toHaveBeenCalledWith('/learn/?course=phase-two'))
})
it('keeps unavailable invitations in the trial flow without a general sign-in or email request form',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'This trial invitation is no longer available.'})}));const enter=vi.fn()
  render(<TrialAccessEntry onEnter={enter}/>);await screen.findByRole('alert');expect(enter).not.toHaveBeenCalled();expect(auth.verifyOtp).not.toHaveBeenCalled();expect(screen.queryByRole('textbox')).toBeNull()
})
it('does not enter the portal if verification fails or yields a different identity',async()=>{
  auth.verifyOtp.mockResolvedValue({data:{session:{user:{id:'someone-else'}}},error:null})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({token_hash:'synthetic-auth-token',type:'invite',learner_id:'assigned-learner',phase:1})}));const enter=vi.fn()
  render(<TrialAccessEntry onEnter={enter}/>);await screen.findByRole('alert');expect(enter).not.toHaveBeenCalled()
})
it('rejects an incomplete invitation before contacting the backend',async()=>{
  window.history.replaceState(null,'','/learn/?view=trial-access');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
  render(<TrialAccessEntry onEnter={vi.fn()}/>);await screen.findByRole('alert');expect(fetcher).not.toHaveBeenCalled()
})
