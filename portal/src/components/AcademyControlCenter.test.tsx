import {render,screen,waitFor,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {AcademyControlCenter} from './AcademyControlCenter'
import type {Snapshot} from './controlTypes'
const courseId='00000000-0000-4000-8000-000000000001'
const id='00000000-0000-4000-8000-000000000002'
const snapshot={updated_at:'2026-10-16T06:00:00Z',enrollments:[{id,learner_id:id,course_id:courseId,phase_number:1,course_title:'Phase One',status:'active',effective_access:'active',course_status:'published',email:'learner@example.com',display_name:'Learner One',first_name:'Learner',account_status:'active',enrollment_type:'trial',payment_mode:'unrecorded',record_label:null,enrolled_at:'2026-10-16T00:00:00Z',starts_at:null,access_expires_at:'2026-12-01T00:00:00Z',onboarding_completed_at:null,last_sign_in_at:null,invited_at:null,last_lesson:null,last_learning_activity:null,updated_at:'2026-10-16T06:00:00Z',lessons_completed:0,total_lessons:36,payment:{kind:'direct',status:'no payment record',paid:0,total:0,currency:'usd',completed:null,next_due_at:null,next_amount:null,grace_until:null,reminder_sent_for_due_at:null}}],summary:{enrollments:1,active:1,trials:1,paused:0,live_collected_usd:0,upcoming:0,overdue:0,unclassified:0},courses:[{id:courseId,phase_number:1,title:'AI Confidence Academy Phase One: AI Foundations',status:'published',updated_at:'2026-10-16T00:00:00Z',default_access_days:90}],journeys:[],lessons:[],emails:[],payments:[],refunds:[],trials:[],cohorts:[],feedback:[],activity:[],automations:[],newsletter:{subscribers:0,sync_issues:0,editions:[]},configuration:{database:'connected',payments:true,email:true,emailTracking:true,paymentTracking:true,scheduler:true},request_duration_ms:20} satisfies Snapshot
const response=(value:unknown,status=200)=>({ok:status<400,status,json:async()=>value})
afterEach(()=>vi.unstubAllGlobals())
it('opens each working section and keeps the default view focused on Academy operations',async()=>{
 const user=userEvent.setup();const fetcher=vi.fn(async(url:string)=>response(url.endsWith('/api/operations/support')?{cases:[],messages:[]}:snapshot));vi.stubGlobal('fetch',fetcher)
 render(<AcademyControlCenter accessToken="owner-token"/>);expect(await screen.findByRole('heading',{name:'Phase operations'})).toBeTruthy()
 expect(fetcher.mock.calls[0][0]).toContain('scope=operational')
 const nav=screen.getByRole('navigation',{name:'Academy administration'})
 for(const title of ['Learners','Curriculum & releases','Access & trials','Payments','Email center','Support & feedback','System activity']){await user.click(within(nav).getByRole('button',{name:title}));expect(screen.getByRole('heading',{level:1,name:title})).toBeTruthy()}
 expect(screen.getByText('Configuration confirms that a connection is set up. The run history below shows what actually executed.')).toBeTruthy()
 expect(screen.getAllByText('No run recorded since instrumentation began')).toHaveLength(4)
 expect(screen.getByText('operations monitor')).toBeTruthy()
 expect(screen.getByText('21:00')).toBeTruthy()
})
it('reviews the recipient and dates before sending the invitation directly by email',async()=>{
 const user=userEvent.setup();const fetcher=vi.fn(async(_url:string,options:RequestInit)=>options.method==='POST'?response({ok:true,id,emailSent:true,recipient:'invited@example.com',starts_at:'2090-01-01T09:00:00Z',expires_at:'2090-02-01T09:00:00Z'}):response(snapshot));vi.stubGlobal('fetch',fetcher)
 render(<AcademyControlCenter accessToken="owner-token"/>);await screen.findByRole('heading',{name:'Phase operations'})
 await user.click(screen.getByRole('button',{name:'Grant trial access'}));await user.type(screen.getByLabelText('Assigned learner email'),'invited@example.com')
 const start=screen.getByLabelText('Access begins'),end=screen.getByLabelText('Access ends');await user.clear(start);await user.type(start,'2090-01-01T09:00');await user.clear(end);await user.type(end,'2090-02-01T09:00')
 await user.click(screen.getByRole('button',{name:'Review invitation'}));expect(fetcher.mock.calls.filter(([,o])=>o.method==='POST')).toHaveLength(0)
 expect(screen.getByText('Send the secure invitation directly to the assigned email. Access follows the reviewed dates.')).toBeTruthy()
 await user.click(screen.getByRole('button',{name:'Send invitation'}));await screen.findByRole('heading',{name:'Invitation sent'})
 const call=fetcher.mock.calls.find(([,o])=>o.method==='POST')!;const body=JSON.parse(call[1].body as string)
 expect(body.action).toBe('trial_create');expect(body.payload.email).toBe('invited@example.com');expect(body.payload.code).toMatch(/^ACA_[a-f0-9]{64}$/);expect(body.payload.starts_at).toBe(new Date('2090-01-01T09:00').toISOString())
 expect(screen.queryByRole('button',{name:'Copy invitation link'})).toBeNull();expect(screen.getByText('invited@example.com')).toBeTruthy()
})
it('keeps a failed saved invitation available for email-only retry',async()=>{
 let posts=0;const calls:Array<{action:string;payload:unknown}>=[];const user=userEvent.setup()
 vi.stubGlobal('fetch',vi.fn(async(_url:string,options:RequestInit)=>{if(options.method!=='POST')return response(snapshot);calls.push(JSON.parse(options.body as string));posts++;return posts===1?response({invitationSaved:true,id,error:'Invitation saved, but its email could not be sent. Retry sending this invitation.'},502):response({ok:true,id,emailSent:true,recipient:'retry@example.com',starts_at:'2090-01-01',expires_at:'2090-02-01'})}))
 render(<AcademyControlCenter accessToken="owner-token"/>);await screen.findByRole('heading',{name:'Phase operations'});await user.click(screen.getByRole('button',{name:'Grant trial access'}));await user.type(screen.getByLabelText('Assigned learner email'),'retry@example.com');await user.click(screen.getByRole('button',{name:'Review invitation'}));await user.click(screen.getByRole('button',{name:'Send invitation'}))
 await screen.findByRole('alert');expect(screen.getByText('retry@example.com')).toBeTruthy();expect(screen.queryByRole('button',{name:'Back'})).toBeNull();await user.click(screen.getByRole('button',{name:'Retry sending invitation'}));await screen.findByRole('heading',{name:'Invitation sent'})
 expect(calls.map(c=>c.action)).toEqual(['trial_create','trial_send']);expect(calls[1].payload).toEqual({id})
})
it('sends a previously saved invitation without requiring its raw code or recreating the grant',async()=>{
 const trial={id,allowed_email:'saved@example.com',course_id:courseId,cohort_id:null,starts_at:'2090-01-01T00:00:00Z',expires_at:'2090-02-01T00:00:00Z',status:'ready',enrollment_id:null,created_at:'2026-10-17',updated_at:'2026-10-17'}
 const user=userEvent.setup(),fetcher=vi.fn(async(_url:string,options:RequestInit)=>options.method==='POST'?response({ok:true,id,emailSent:true,recipient:trial.allowed_email,starts_at:trial.starts_at,expires_at:trial.expires_at}):response({...snapshot,trials:[trial]}));vi.stubGlobal('fetch',fetcher)
 render(<AcademyControlCenter accessToken="owner-token"/>);await screen.findByRole('heading',{name:'Phase operations'});await user.click(within(screen.getByRole('navigation',{name:'Academy administration'})).getByRole('button',{name:'Access & trials'}));await user.click(await screen.findByRole('button',{name:'Send invitation'}));expect(fetcher.mock.calls.filter(([,o])=>o.method==='POST')).toHaveLength(0)
 const dialog=screen.getByRole('dialog');expect(within(dialog).getByText(trial.allowed_email)).toBeTruthy();await user.click(within(dialog).getByRole('button',{name:'Send invitation'}));await screen.findByRole('heading',{name:'Invitation sent'})
 expect(JSON.parse(fetcher.mock.calls.find(([,o])=>o.method==='POST')![1].body as string)).toMatchObject({action:'trial_send',payload:{id}})
})
it('opens learner diagnostics using the selected enrollment rather than inventing progress',async()=>{
 const user=userEvent.setup();const detail={enrollment:snapshot.enrollments[0],access_state:null,lessons:[{id, page_id:'1.1',title:'First lesson',progress_status:null,access_status:'restricted',restriction_reason:'Founder welcome and Learning ChatGPT orientation are required.',scheduled_release:null,deadline_at:null,last_step:null}],workbooks:[],phase_two_workbooks:[],project:null,emails:[],activity:[]}
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>response(url.includes('?enrollment=')?detail:snapshot)))
 render(<AcademyControlCenter accessToken="owner-token"/>);await screen.findByRole('heading',{name:'Phase operations'});await user.click(screen.getByRole('button',{name:/Learner One/}));await screen.findByRole('heading',{name:'Learner One'})
 const nav=screen.getByRole('navigation',{name:'Learner detail'});await user.click(within(nav).getByRole('button',{name:'access'}));expect(screen.getByText('Founder welcome and Learning ChatGPT orientation are required.')).toBeTruthy()
})
it('clears owner records when the server rejects a refreshed session',async()=>{
 let denied=false;vi.stubGlobal('fetch',vi.fn(async()=>response(denied?{error:'Academy owner access is required.'}:snapshot,denied?403:200)))
 const user=userEvent.setup();render(<AcademyControlCenter accessToken="owner-token"/>);await screen.findByRole('heading',{name:'Phase operations'});denied=true
 await user.click(screen.getByRole('button',{name:'Refresh Academy records'}));expect(await screen.findByRole('alert')).toHaveProperty('textContent','Academy owner access is required.');await waitFor(()=>expect(screen.queryByText('Learner One')).toBeNull())
})
