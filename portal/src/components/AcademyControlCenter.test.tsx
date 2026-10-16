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
 const user=userEvent.setup();const fetcher=vi.fn().mockResolvedValue(response(snapshot));vi.stubGlobal('fetch',fetcher)
 render(<AcademyControlCenter accessToken="owner-token"/>);expect(await screen.findByRole('heading',{name:'Phase operations'})).toBeTruthy()
 expect(fetcher.mock.calls[0][0]).toContain('scope=operational')
 const nav=screen.getByRole('navigation',{name:'Academy administration'})
 for(const title of ['Learners','Curriculum & releases','Access & trials','Payments','Email center','Feedback','System activity']){await user.click(within(nav).getByRole('button',{name:title}));expect(screen.getByRole('heading',{level:1,name:title})).toBeTruthy()}
 expect(screen.getByText('Configuration confirms that a connection is set up. The run history below shows what actually executed.')).toBeTruthy()
 expect(screen.getAllByText('No run recorded since instrumentation began')).toHaveLength(3)
})
it('requires a review step before creating a real trial and exposes the raw code only in the resulting invitation',async()=>{
 const user=userEvent.setup();const fetcher=vi.fn(async(_url:string,options:RequestInit)=>options.method==='POST'?response({ok:true,id,code:JSON.parse(options.body as string).payload.code}):response(snapshot));vi.stubGlobal('fetch',fetcher)
 render(<AcademyControlCenter accessToken="owner-token"/>);await screen.findByRole('heading',{name:'Phase operations'})
 await user.click(screen.getByRole('button',{name:'Grant trial access'}));await user.type(screen.getByLabelText('Assigned learner email'),'invited@example.com')
 await user.click(screen.getByRole('button',{name:'Review change'}));expect(fetcher.mock.calls.filter(([,o])=>o.method==='POST')).toHaveLength(0)
 expect(screen.getByText('This action is applied to the real Academy and recorded in its activity history.')).toBeTruthy()
 await user.click(screen.getByRole('button',{name:'Apply authorized change'}));await screen.findByRole('heading',{name:'Your trial invitation is ready'})
 const call=fetcher.mock.calls.find(([,o])=>o.method==='POST')!;const body=JSON.parse(call[1].body as string)
 expect(body.action).toBe('trial_create');expect(body.payload.email).toBe('invited@example.com');expect(body.payload.code).toMatch(/^ACA_[a-f0-9]{64}$/)
 const link=screen.getByLabelText('Invitation link') as HTMLTextAreaElement;expect(link.value).toContain('/learn/?view=trial#code=ACA_');expect(link.value.split('#')[0]).not.toContain(body.payload.code)
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
