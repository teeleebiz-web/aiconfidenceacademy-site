import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import {handleControlCenter,handleTrialEntry,handleLearnerFeedback,diagnoseLessons,recordAutomationRun} from './control-center.mjs'
const actor='00000000-0000-4000-8000-000000000001'
const requestId='00000000-0000-4000-8000-000000000002'
function fixture({owner=true,invalid=false,failure=false}={}) {
 const calls=[]
 const db={auth:{getUser:async()=>({data:{user:invalid?null:{id:actor,user_metadata:{is_owner:true}}},error:invalid?Error():null})},rpc:async(name,args)=>{calls.push({name,args});return failure?{error:{message:'whsec_secret-private',code:'DB_FAILURE'}}:{data:name==='aca_control_snapshot'?{enrollments:[],summary:{},courses:[],lessons:[]}: {ok:true,id:requestId}}}}
 return {db,calls,reviewerCheck:async()=>owner,automation:{stripe:{},resend:{},resendWebhookSecret:'secret'}}
}
async function run(handler,config,{method='GET',url='/api/operations/control-center',body,token='session'}={}){
 const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);Object.assign(req,{method,url,headers:token?{'x-aca-access-token':token}:{}})
 const res={writeHead(status,headers){this.status=status;this.headers=headers},end(text){this.body=JSON.parse(text)}}
 await handler(req,res,config);return res
}
test('control center does not read or mutate records without verified owner authorization',async()=>{
 for(const [config,token,status] of [[fixture(),null,401],[fixture({invalid:true}),'bad',401],[fixture({owner:false}),'session',403]]){
  const res=await run(handleControlCenter,config,{method:'POST',token,body:{action:'trial_create',requestId,payload:{}}});assert.equal(res.status,status);assert.equal(config.calls.length,0)
 }
})
test('overview defaults to actual operations and excludes fixtures through the server filter',async()=>{
 const c=fixture();const r=await run(handleControlCenter,c)
 assert.equal(r.status,200);assert.equal(c.calls[0].args.p_scope,'operational');assert.equal(r.body.configuration.emailTracking,true);assert.match(r.headers['Cache-Control'],/no-store/)
})
test('owner actions derive the actor from the verified session, whitelist fields, and store only a code hash',async()=>{
 const c=fixture();const code='ACA_'+'a'.repeat(64)
 const res=await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_create',actor:'attacker',payload:{code,email:'learner@example.com',course_id:requestId,starts_at:'2026-10-16T00:00:00Z',expires_at:'2026-12-01T00:00:00Z',is_owner:true}}})
 assert.equal(res.status,200);assert.equal(c.calls[0].args.p_actor,actor);assert.equal(c.calls[0].args.p_payload.code,undefined);assert.equal(c.calls[0].args.p_payload.code_hash.length,64);assert.equal(c.calls[0].args.p_payload.is_owner,undefined);assert.equal(res.body.code,code)
})
test('malformed action identifiers and unsupported actions cannot reach owner mutation RPC',async()=>{
 for(const body of [{requestId:'bad',action:'trial_create',payload:{}},{requestId,action:'delete_everything',payload:{}},{requestId,action:'trial_create',payload:{code:'1234'}}]){
 const c=fixture();assert.equal((await run(handleControlCenter,c,{method:'POST',body})).status,400);assert.equal(c.calls.length,0)
 }
})
test('database failures return a reference and cannot disclose private provider content',async()=>{
 const r=await run(handleControlCenter,fixture({failure:true}));assert.equal(r.status,503);assert.ok(r.body.reference);assert.doesNotMatch(JSON.stringify(r.body),/secret-private/)
})
test('feedback cannot be submitted for another learner enrollment',async()=>{
 const c=fixture();c.db.from=()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null})})
 const r=await run(handleLearnerFeedback,c,{method:'POST',body:{requestId,enrollmentId:requestId,category:'access',message:'The lesson could not open'}});assert.equal(r.status,403)
})
test('invalid trial codes never create accounts, enrollments, or emails',async()=>{
 const c=fixture();const r=await run(handleTrialEntry,{...c,resend:{},emailFrom:'Academy',appUrl:'https://aiconfidenceacademy.org'},{method:'POST',body:{code:'1234',email:'person@example.com'},token:null});assert.equal(r.status,400);assert.equal(c.calls.length,0)
})
test('a valid-looking code assigned to a different email cannot generate an account or send an invitation',async()=>{
 const c=fixture();let generated=false
 c.db.rpc=async()=>({data:true});c.db.auth.admin={generateLink:async()=>{generated=true}}
 c.db.from=()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{allowed_email:'assigned@example.com',status:'ready',expires_at:'2099-01-01'}})})
 const r=await run(handleTrialEntry,{...c,resend:{},emailFrom:'Academy',appUrl:'https://aiconfidenceacademy.org'},{method:'POST',body:{code:'ACA_'+'a'.repeat(64),email:'different@example.com'}})
 assert.equal(r.status,400);assert.equal(generated,false)
})
const base={enrollment:{effective_access:'active',course_status:'published',phase_number:1,onboarding_completed_at:'2026-10-01'},access_state:{current_lesson_id:'next',access_status:'scheduled'},lessons:[{id:'next',status:'published',journey_status:'published'}]}
test('restriction diagnostics explain orientation, sequential release, expired access and Phase Two cohort restrictions',()=>{
 assert.match(diagnoseLessons({...base,enrollment:{...base.enrollment,onboarding_completed_at:null}})[0].restriction_reason,/orientation/)
 assert.equal(diagnoseLessons(base)[0].access_status,'scheduled')
 assert.match(diagnoseLessons({...base,enrollment:{...base.enrollment,effective_access:'expired'}})[0].restriction_reason,/expired/)
 assert.match(diagnoseLessons({...base,enrollment:{...base.enrollment,phase_number:2}})[0].restriction_reason,/cohort/)
 const active={...base,enrollment:{...base.enrollment,phase_number:2},lessons:[{...base.lessons[0],cohort_status:'active',scheduled_release:'2020-01-01',phase_two_deadline:'2099-01-01'}]}
 assert.equal(diagnoseLessons(active)[0].access_status,'active')
})
test('unauthorized cron probes do not create automation history or bypass the original authorization',async()=>{
 let called=false;const req={method:'GET',headers:{authorization:'wrong'}};await recordAutomationRun(req,{}, {db:{from(){throw Error('must not record')}},cronSecret:'secret'},'job',async()=>{called=true});assert.equal(called,true)
})

test('full history validates sections and enforces the same owner gate',async()=>{
 const c=fixture();const denied=await run(handleControlCenter,fixture({owner:false}),{url:'/api/operations/control-center?history=emails'});assert.equal(denied.status,403)
 assert.equal((await run(handleControlCenter,c,{url:'/api/operations/control-center?history=secrets'})).status,400)
 const r=await run(handleControlCenter,c,{url:'/api/operations/control-center?history=emails&offset=50&phase=2&scope=all&search=receipt'})
 assert.equal(r.status,200);assert.deepEqual(c.calls[0],{name:'aca_control_history',args:{p_section:'emails',p_offset:50,p_phase:2,p_scope:'all',p_search:'receipt'}})
})
test('authorized automation preserves the original response and records warning results durably',async()=>{
 const updates=[];const db={from(){return {insert(){return this},select(){return this},single:async()=>({data:{id:requestId}}),update(value){updates.push(value);return this},eq:async()=>({error:null})}}}
 const res={writeHead(s,h){this.status=s;this.headers=h},end(v){this.body=JSON.parse(v)}}
 await recordAutomationRun({method:'GET',headers:{authorization:'Bearer secret'}},res,{db,cronSecret:'secret'},'lesson-releases',async(_req,response)=>{response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({sent:1,failed:1}))})
 assert.equal(res.status,200);assert.deepEqual(res.body,{sent:1,failed:1});assert.equal(updates[0].status,'warning');assert.ok(updates[0].finished_at)
})
