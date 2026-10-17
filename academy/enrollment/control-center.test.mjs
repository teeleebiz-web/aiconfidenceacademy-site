import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import {handleControlCenter,handleTrialAccept,handleTrialEntry,handleLearnerFeedback,diagnoseLessons,recordAutomationRun} from './control-center.mjs'
const actor='00000000-0000-4000-8000-000000000001'
const requestId='00000000-0000-4000-8000-000000000002'
function fixture({owner=true,invalid=false,failure=false}={}) {
 const calls=[],sends=[],tables={aca_trial_grants:[{id:requestId,code_hash:'b'.repeat(64),allowed_email:'learner@example.com',course_id:actor,starts_at:'2090-01-01T00:00:00Z',expires_at:'2090-03-01T00:00:00Z',status:'ready'}],courses:[{id:actor,title:'ACA',phase_number:1,status:'published'}],aca_email_events:[]}
 let links=0,providerFailure=false,transportFailure=false
 const db={auth:{getUser:async()=>({data:{user:invalid?null:{id:actor,user_metadata:{is_owner:true}}},error:invalid?Error():null}),admin:{generateLink:async()=>{links++;return {data:{user:{id:actor},properties:{action_link:`https://auth.example/verify?token=private-${links}`,hashed_token:`private-${links}`,verification_type:'invite'}}}}}},rpc:async(name,args)=>{calls.push({name,args});return failure?{error:{message:'whsec_secret-private',code:'DB_FAILURE'}}:{data:name==='aca_control_snapshot'?{enrollments:[],summary:{},courses:[],lessons:[]}:name==='aca_trial_rate_limit'?true:name==='aca_redeem_trial'?{enrollment_id:requestId}:{ok:true,id:requestId}}},from(table){
  let filters=[],write=null,rows=()=>tables[table].filter(r=>filters.every(f=>f(r)))
  const execute=()=>{if(write){if(write.kind==='upsert'){let r=tables[table].find(r=>r.event_key===write.value.event_key);if(!r){r={id:requestId,attempts:0,...write.value};tables[table].push(r)}else if(!write.ignore)Object.assign(r,write.value);return [r]}const found=rows();for(const r of found)Object.assign(r,write.value);return found}return rows()}
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},upsert(value,options){write={kind:'upsert',value,ignore:options?.ignoreDuplicates};return q},update(value){write={kind:'update',value};return q},maybeSingle:async()=>({data:execute()[0]||null}),single:async()=>({data:execute()[0]||null}),then(resolve,reject){return Promise.resolve({data:execute()}).then(resolve,reject)}}
  return q
 }}
 const automation={db,resend:{emails:{send:async(...args)=>{sends.push(args);if(transportFailure)throw Error('private network detail');return providerFailure?{error:{message:'private provider rejection'}}:{data:{id:'provider-1'}}}}},emailFrom:'ACA <notifications@example.test>',appUrl:'https://aiconfidenceacademy.org',stripe:{},resendWebhookSecret:'secret'}
 return {db,calls,sends,tables,reviewerCheck:async()=>owner,automation,get links(){return links},set providerFailure(value){providerFailure=value},set transportFailure(value){transportFailure=value}}
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
 assert.equal(res.status,200);assert.equal(c.calls[0].args.p_actor,actor);assert.equal(c.calls[0].args.p_payload.code,undefined);assert.equal(c.calls[0].args.p_payload.code_hash.length,64);assert.equal(c.calls[0].args.p_payload.is_owner,undefined);assert.equal(res.body.code,undefined);assert.equal(res.body.emailSent,true);assert.equal(c.sends[0][0].to,'learner@example.com')
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

test('owner can email the existing unsent grant using only its ID; recipient and dates come from the saved grant',async()=>{
 const c=fixture(),r=await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_send',payload:{id:requestId,email:'attacker@example.com',starts_at:'2000-01-01'}}})
 assert.equal(r.status,200);assert.equal(r.body.recipient,'learner@example.com');assert.equal(r.body.starts_at,c.tables.aca_trial_grants[0].starts_at)
 assert.equal(c.calls.some(x=>x.name==='aca_control_action'),false);assert.equal(c.calls.length,0);assert.notEqual(c.tables.aca_trial_grants[0].code_hash,'b'.repeat(64))
 assert.match(c.sends[0][0].html,/Open my trial/);assert.match(c.sends[0][0].html,/2090/);assert.doesNotMatch(JSON.stringify(c.tables.aca_email_events),/private-1/)
 assert.equal(c.tables.aca_email_events[0].status,'sent');assert.equal(c.tables.aca_email_events[0].metadata.invited_by,actor)
 const again=await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_send',payload:{id:requestId}}})
 assert.equal(again.body.duplicate,true);assert.equal(c.sends.length,1);assert.equal(c.links,0)
})
test('email configuration must be present before a new grant is saved',async()=>{
 const c=fixture();c.automation.resend=null
 const r=await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_create',payload:{code:'ACA_'+'a'.repeat(64)}}})
 assert.equal(r.status,503);assert.equal(c.calls.length,0)
})
test('revoked, converted, expired, and missing grants cannot send emails or change access',async()=>{
 for(const state of ['revoked','converted','expired','missing']){
  const c=fixture();if(state==='missing')c.tables.aca_trial_grants=[];else if(state==='expired')c.tables.aca_trial_grants[0].expires_at='2000-01-01';else c.tables.aca_trial_grants[0].status=state
  assert.equal((await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_send',payload:{id:requestId}}})).status,409);assert.equal(c.links,0);assert.equal(c.sends.length,0);assert.equal(c.calls.length,0)
 }
})
test('an explicit email failure retains the grant and can be retried without creating another invitation',async()=>{
 const c=fixture();c.providerFailure=true
 const r=await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_create',payload:{code:'ACA_'+'a'.repeat(64),email:'learner@example.com'}}})
 assert.equal(r.status,502);assert.equal(r.body.invitationSaved,true);assert.equal(r.body.id,requestId);assert.doesNotMatch(JSON.stringify(r.body),/private provider/);assert.equal(c.tables.aca_email_events[0].status,'failed')
 c.providerFailure=false
 const retry=await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_send',payload:{id:requestId}}})
 assert.equal(retry.status,200);assert.equal(c.calls.filter(x=>x.name==='aca_control_action').length,1);assert.equal(c.tables.aca_email_events.length,1)
 assert.notEqual(c.sends[0][1].idempotencyKey,c.sends[1][1].idempotencyKey)
})
test('concurrent sends claim one email before rotating the invitation token',async()=>{
 const c=fixture(),options={method:'POST',body:{requestId,action:'trial_send',payload:{id:requestId}}}
 const results=await Promise.all([run(handleControlCenter,c,options),run(handleControlCenter,c,options)])
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(c.links,0);assert.equal(c.sends.length,1)
})
test('an uncertain provider submission is not retried by generating a competing Auth link',async()=>{
 const c=fixture();c.transportFailure=true;const options={method:'POST',body:{requestId,action:'trial_send',payload:{id:requestId}}}
 assert.equal((await run(handleControlCenter,c,options)).status,503);assert.equal(c.tables.aca_email_events[0].status,'sending')
 const retry=await run(handleControlCenter,c,options);assert.equal(retry.status,409);assert.equal(c.links,0);assert.equal(c.sends.length,1)
})
test('the owner email action accepts Vercel parsed JSON bodies without reading a consumed stream',async()=>{
 const c=fixture(),req={method:'POST',url:'/api/operations/control-center',headers:{'x-aca-access-token':'owner'},body:{requestId,action:'trial_send',payload:{id:requestId}}},res={writeHead(s){this.status=s},end(v){this.body=JSON.parse(v)}}
 await handleControlCenter(req,res,c);assert.equal(res.status,200);assert.equal(c.sends.length,1)
})
test('trial acceptance preserves existing enrollment restrictions before returning a verification token',async()=>{
 const c=fixture(),rpc=c.db.rpc
 c.db.rpc=async(name,args)=>name==='aca_redeem_trial'?{error:{code:'P0001',message:'An existing enrollment requires owner review'}}:rpc(name,args)
 const code='ACA_'+'a'.repeat(64);
 // Use the same SHA-256 derivation as the invitation database contract.
 const {createHash}=await import('node:crypto');c.tables.aca_trial_grants[0].code_hash=createHash('sha256').update(code).digest('hex')
 const r=await run(handleTrialAccept,c.automation,{method:'POST',body:{code}})
 assert.equal(r.status,409);assert.equal(r.body.token_hash,undefined);assert.equal(c.sends.length,0)
})
test('non-owners cannot use the direct invitation email action',async()=>{
 const c=fixture({owner:false}),r=await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_send',payload:{id:requestId}}})
 assert.equal(r.status,403);assert.equal(c.links,0);assert.equal(c.sends.length,0);assert.equal(c.calls.length,0)
})

test('the emailed trial button carries one private grant token and no generic sign-in or password instructions',async()=>{
 const c=fixture();await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_send',payload:{id:requestId}}})
 const html=c.sends[0][0].html,links=[...html.matchAll(/href="([^"]+)"/g)]
 assert.equal(links.length,1);assert.match(links[0][1],/\/learn\/\?view=trial-access#invite=ACA_[a-f0-9]{64}/);assert.doesNotMatch(html,/password|sign.in|another email|secure.*expired/i)
 const code=links[0][1].split('#invite=')[1],{createHash}=await import('node:crypto')
 assert.equal(c.tables.aca_trial_grants[0].code_hash,createHash('sha256').update(code).digest('hex'));assert.doesNotMatch(JSON.stringify(c.tables),new RegExp(code));assert.equal(c.links,0)
})
test('the same invitation opens direct access repeatedly without another email or client-selected identity',async()=>{
 const c=fixture();await run(handleControlCenter,c,{method:'POST',body:{requestId,action:'trial_send',payload:{id:requestId}}})
 const code=c.sends[0][0].html.match(/#invite=(ACA_[a-f0-9]{64})/)[1]
 for(let i=0;i<2;i++){
  const r=await run(handleTrialAccept,c.automation,{method:'POST',body:{code,email:'attacker@example.com'}})
  assert.equal(r.status,200);assert.equal(r.body.phase,1);assert.equal(r.body.learner_id,actor);assert.ok(r.body.token_hash);assert.match(r.headers['Cache-Control'],/no-store/)
  assert.equal(c.calls.filter(x=>x.name==='aca_redeem_trial').at(-1).args.p_email,'learner@example.com')
 }
 assert.equal(c.sends.length,1);assert.equal(c.links,2)
})
test('invalid, revoked, converted and expired trial tokens never yield Auth verification',async()=>{
 const {createHash}=await import('node:crypto'),code='ACA_'+'a'.repeat(64)
 for(const state of ['missing','revoked','converted','expired']){
  const c=fixture();c.tables.aca_trial_grants[0].code_hash=createHash('sha256').update(code).digest('hex')
  if(state==='missing')c.tables.aca_trial_grants=[];else if(state==='expired')c.tables.aca_trial_grants[0].expires_at='2000-01-01';else c.tables.aca_trial_grants[0].status=state
  const r=await run(handleTrialAccept,c.automation,{method:'POST',body:{code}});assert.equal(r.status,410);assert.equal(c.links,0);assert.equal(c.sends.length,0)
 }
 const c=fixture();assert.equal((await run(handleTrialAccept,c.automation,{method:'POST',body:{code:'bad'}})).status,400);assert.equal((await run(handleTrialAccept,c.automation)).status,405)
})
