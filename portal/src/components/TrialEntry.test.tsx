import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {TrialEntry} from './TrialEntry'
afterEach(()=>{vi.unstubAllGlobals();window.history.replaceState(null,'','/')})
it('reads the private invitation fragment, submits only to access entry, and clears it after success',async()=>{
 const code='ACA_'+'a'.repeat(64);window.history.replaceState(null,'',`/learn/?view=trial#code=${code}`)
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true})});vi.stubGlobal('fetch',fetcher)
 const user=userEvent.setup();render(<TrialEntry/>);expect((screen.getByLabelText('Invitation code') as HTMLInputElement).value).toBe(code)
 await user.type(screen.getByLabelText('Assigned email'),'assigned@example.com');await user.click(screen.getByRole('button',{name:'Email my secure access link'}));await screen.findByRole('status')
 expect(fetcher.mock.calls[0][0]).toContain('/api/trials/request-access');expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({code,email:'assigned@example.com'});expect(window.location.hash).toBe('')
})
