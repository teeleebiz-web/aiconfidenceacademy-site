import {readFileSync,writeFileSync} from 'node:fs'
import {StrictMode} from 'react'
import {render,screen,waitFor} from '@testing-library/react'
import {TrialAccessEntry} from '../src/TrialAccessEntry'
import {supabase} from '../src/lib/supabase'

// Opt-in only: an isolated, disposable pair of owner-authorized invitations.
// The first has already enrolled this recipient; the second reproduces the bug.
// Never supply an actual learner's invitation or persist its secret in the repo.
const fixturePath=process.env.ACA_TRIAL_FIXTURE_FILE
it.skipIf(!fixturePath)('opens a repeated invitation through live Auth into the existing Academy welcome',async()=>{
 const fixture=JSON.parse(readFileSync(fixturePath!,'utf8'))
 const evidencePath=process.env.ACA_TRIAL_EVIDENCE_FILE
 const evidence=JSON.parse(readFileSync(evidencePath!,'utf8'))
 const enter=vi.fn()
 try {
  window.history.replaceState(null,'',`/learn/?view=trial-access#invite=${fixture.secondCode}`)
  const invitation=render(<StrictMode><TrialAccessEntry onEnter={enter}/></StrictMode>)
  expect(screen.queryByRole('textbox')).toBeNull()
  await waitFor(()=>expect(enter).toHaveBeenCalledWith('/learn/'),{timeout:90000})
  expect(enter).toHaveBeenCalledTimes(1)
  expect(window.location.hash).toBe('')
  const user=await supabase.auth.getUser()
  expect(user.error).toBeNull();expect(user.data.user?.email).toBe(fixture.email)
  const enrollments=await supabase.from('enrollments').select('id,status,starts_at,access_expires_at,onboarding_completed_at').eq('learner_id',user.data.user!.id)
  expect(enrollments.error).toBeNull();expect(enrollments.data).toEqual([evidence.enrollment])
  expect((await supabase.auth.getSession()).data.session?.user.id).toBe(evidence.userId)
  invitation.unmount()
  window.history.replaceState(null,'','/learn/')
  const {App}=await import('../src/App')
  const academy=render(<App/>)
  await screen.findByRole('button',{name:'Sign out'},{timeout:90000})
  await waitFor(()=>expect(document.querySelector('video')?.getAttribute('src')).toMatch(/\/storage\/v1\/object\/sign\//),{timeout:90000})
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  const welcomeHeading=screen.getByRole('heading',{level:1}).textContent
  expect(welcomeHeading).toMatch(/welcome/i)
  evidence.liveComponent={verifiedIdentity:true,persistedSession:true,oneUnchangedEnrollment:true,entered:'/learn/',welcomeHeading,welcomeVideoAuthorized:true,noEmailOrPasswordForm:true}
  writeFileSync(evidencePath!,JSON.stringify(evidence),{mode:0o600})
  academy.unmount()
 } finally {await supabase.auth.signOut()}
},240000)
