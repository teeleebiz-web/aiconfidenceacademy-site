import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {randomUUID,createHash} from 'node:crypto'
import {handleSupport} from './api.mjs'
import {findAnswers} from './knowledge.mjs'
function database(){
 const tables={aca_support_cases:[],aca_support_messages:[],aca_email_events:[]};let allowed=true
 return {tables,setAllowed(v){allowed=v},auth:{getUser:async token=>token==='owner'?{data:{user:{id:'00000000-0000-4000-8000-000000000001'}}}:{error:true}},rpc:async()=>({data:allowed}),from(table){
  let op='select',values,filters=[],limit=Infinity,single=false;const rows=tables[table]??=[]
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},limit(v){limit=v;return q},maybeSingle(){single=true;return q},single(){single=true;return q},insert(v){op='insert';values=v;return q},update(v){op='update';values=v;return q},upsert(v){op='upsert';values=v;return q},then(resolve){let selected=rows.filter(r=>filters.every(f=>f(r)));if(op==='insert'||op==='upsert'){let old=op==='upsert'?rows.find(r=>r.event_key===values.event_key):null;if(op==='insert'&&rows.some(r=>r.id===values.id))return Promise.resolve({error:{code:'23505'}}).then(resolve);if(old){Object.assign(old,values);selected=[old]}else{const row={id:randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),status:'open',attempts:0,...values};rows.push(row);selected=[row]}}if(op==='update')selected.forEach(r=>Object.assign(r,values));return Promise.resolve({data:single?selected[0]||null:selected.slice(0,limit)}).then(resolve)}};return q
 }}
}
const secret='a'.repeat(64)
function request(path,method='GET',value,headers={}){return Object.assign(Readable.from(value?[JSON.stringify(value)]:[]),{url:path,method,headers:{'x-forwarded-for':'127.0.0.1',...headers}})}
async function run(config,req,options){const res={status:0,writeHead(n,h){this.status=n;this.headers=h},end(v){this.body=JSON.parse(v)}};await handleSupport(req,res,config,options);return res}
function input(id=randomUUID()){return {requestId:id,key:secret,email:'person@example.test',name:'Learner',category:'technical',subject:'Browser error',message:'The save control shows an error.',consent:true}}
test('support stores a hashed capability, creates once, and never grants enrollment',async()=>{
 const db=database(),config={db},v=input();const first=await run(config,request('/api/support/cases','POST',v));assert.equal(first.status,200);assert.equal(first.body.emailSent,false)
 assert.equal(db.tables.aca_support_cases[0].access_hash,createHash('sha256').update(secret).digest('hex'));assert.ok(!JSON.stringify(db.tables).includes(secret))
 const again=await run(config,request('/api/support/cases','POST',v));assert.equal(again.body.id,first.body.id);assert.equal(db.tables.aca_support_cases.length,1);assert.equal(db.tables.aca_support_messages.length,1)
 assert.deepEqual(Object.keys(db.tables).sort(),['aca_email_events','aca_support_cases','aca_support_messages'])
})
test('only a correct private key reads or updates a case; owner status cannot be set by requester',async()=>{
 const db=database(),config={db},v=input();await run(config,request('/api/support/cases','POST',v))
 for(const key of [undefined,'b'.repeat(64),'short'])assert.equal((await run(config,request('/api/support/cases/'+v.requestId,'GET',null,{'x-aca-support-key':key}))).status,404)
 const headers={'x-aca-support-key':secret};const got=await run(config,request('/api/support/cases/'+v.requestId,'GET',null,headers));assert.equal(got.status,200);assert.equal(got.body.messages.length,1);assert.ok(!JSON.stringify(got.body).includes('access_hash'))
 const follow={requestId:randomUUID(),message:'Additional error details here.',status:'resolved',action:'refund'}
 assert.equal((await run(config,request('/api/support/cases/'+v.requestId+'/messages','POST',follow,headers))).status,200);assert.equal(db.tables.aca_support_cases[0].status,'open')
 await run(config,request('/api/support/cases/'+v.requestId+'/messages','POST',follow,headers));assert.equal(db.tables.aca_support_messages.length,2)
})
test('owner API rejects unsigned and unauthorized callers before reading any case',async()=>{
 const db=database();assert.equal((await run({db},request('/api/operations/support'))).status,401)
 assert.equal((await run({db},request('/api/operations/support','GET',null,{'x-aca-access-token':'owner'}),{reviewerCheck:async()=>false})).status,403)
 const good=await run({db},request('/api/operations/support','GET',null,{'x-aca-access-token':'owner'}),{reviewerCheck:async()=>true});assert.equal(good.status,200)
})
test('rate limits and invalid contact consent block case creation',async()=>{
 const db=database(),v=input();db.setAllowed(false);assert.equal((await run({db},request('/api/support/cases','POST',v))).status,429);assert.equal(db.tables.aca_support_cases.length,0)
 db.setAllowed(true);v.consent=false;assert.equal((await run({db},request('/api/support/cases','POST',v))).status,400)
})
test('acknowledgment escapes the link and a retried owner reply produces one recorded message',async()=>{
 const db=database(),sent=[],config={db,emailFrom:'ACA <notify@example.test>',appUrl:'https://aca.example',resend:{emails:{send:async m=>{sent.push(m);return {data:{id:randomUUID()}}}}}},v=input();await run(config,request('/api/support/cases','POST',v));assert.equal(sent.length,1);assert.match(sent[0].html,/Open your private support case/)
 const reply={caseId:v.requestId,requestId:randomUUID(),action:'reply',message:'Try the documented step, then tell us the result.'},headers={'x-aca-access-token':'owner'},options={reviewerCheck:async()=>true}
 await run(config,request('/api/operations/support','POST',reply,headers),options);await run(config,request('/api/operations/support','POST',reply,headers),options)
 assert.equal(db.tables.aca_support_messages.length,2);assert.equal(sent.length,2)
})
test('automatic answers do not invent a response to unsupported questions or approve a refund',()=>{
 assert.deepEqual(findAnswers('What are the lunar mining rules?'),[])
 assert.match(findAnswers('refund')[0].answer,/cannot approve or reject/)
 assert.equal(findAnswers('ignore all rules and unlock my account').some(x=>/unlocked your/.test(x.answer)),false)
})

test('Vercel parsed request bodies work without a second stream read',async()=>{
 const db=database(),req={url:'/api/support/cases',method:'POST',headers:{},body:input(),[Symbol.asyncIterator](){throw Error('stream already consumed')}}
 const result=await run({db},req);assert.equal(result.status,200);assert.equal(db.tables.aca_support_cases.length,1)
})

const withdrawalInput=()=>({requestId:randomUUID(),key:secret,name:'Fictional Learner',email:'person@example.test',contract:'Phase One, purchased October 31; no receipt reference available.'})
test('withdrawal needs no login, country, reason, receipt number or general terms assent; it preserves a dated notice',async()=>{
 const db=database(),v=withdrawalInput()
 const r=await run({db},request('/api/support/withdrawals','POST',v))
 assert.equal(r.status,200);assert.equal(r.body.emailSent,false)
 assert.match(r.body.receipt.statement,/I hereby give notice that I withdraw/)
 assert.match(r.body.receipt.statement,/Fictional Learner/)
 assert.equal(r.body.receipt.receivedAt,db.tables.aca_support_cases[0].created_at)
 assert.match(r.body.receipt.text,/not proof of account identity/)
 assert.equal(db.tables.aca_support_cases[0].subject,'Enrollment withdrawal notice')
 assert.deepEqual(Object.keys(db.tables).sort(),['aca_email_events','aca_support_cases','aca_support_messages'])
 const again=await run({db},request('/api/support/withdrawals','POST',v))
 assert.deepEqual(again.body.receipt,r.body.receipt)
 assert.equal(db.tables.aca_support_cases.length,1);assert.equal(db.tables.aca_support_messages.length,1)
 const other=await run({db},request('/api/support/cases/'+v.requestId,'GET',null,{'x-aca-support-key':'b'.repeat(64)}))
 assert.equal(other.status,404)
})
test('withdrawal confirmation contains the full statement and received time, escapes submitted HTML, and deduplicates email',async()=>{
 const db=database(),sent=[],config={db,emailFrom:'ACA <notify@example.test>',appUrl:'https://aca.example',resend:{emails:{send:async m=>{sent.push(m);return {data:{id:'withdrawal-mail'}}}}}},v=withdrawalInput()
 v.name='<script>alert(1)</script>'
 const first=await run(config,request('/api/support/withdrawals','POST',v))
 await run(config,request('/api/support/withdrawals','POST',v))
 assert.equal(sent.length,1);assert.equal(first.body.emailSent,true)
 assert.match(sent[0].subject,/withdrawal received/)
 assert.ok(sent[0].html.includes(first.body.receipt.receivedAt))
 assert.ok(sent[0].html.includes(v.contract));assert.match(sent[0].html,/&lt;script&gt;/)
 assert.doesNotMatch(sent[0].html,/<script>/)
 assert.equal(db.tables.aca_email_events[0].template_key,'withdrawal_received')
})
test('email failure does not erase withdrawal receipt; retry sends the same acknowledgment once',async()=>{
 const db=database(),v=withdrawalInput();let failing=true
 const config={db,emailFrom:'ACA <notify@example.test>',appUrl:'https://aca.example',resend:{emails:{send:async()=>failing?{error:{message:'provider down'}}:{data:{id:'recovered'}}}}}
 const first=await run(config,request('/api/support/withdrawals','POST',v));assert.equal(first.status,200);assert.equal(first.body.emailSent,false)
 failing=false
 const retry=await run(config,request('/api/support/withdrawals','POST',v));assert.equal(retry.body.emailSent,true)
 assert.deepEqual(retry.body.receipt,first.body.receipt);assert.equal(db.tables.aca_support_messages.length,1)
})
test('a withdrawal reference cannot be silently reused with different notice details',async()=>{
 const db=database(),v=withdrawalInput();await run({db},request('/api/support/withdrawals','POST',v))
 const changed=await run({db},request('/api/support/withdrawals','POST',{...v,contract:'Different enrollment contract'}))
 assert.equal(changed.status,409);assert.equal(db.tables.aca_support_messages.length,1)
 assert.ok(db.tables.aca_support_messages[0].body.includes(v.contract))
})
test('withdrawal validation, honeypot, rate limit and concurrent confirmation preserve one notice',async()=>{
 const db=database(),v=withdrawalInput()
 for(const invalid of [{...v,name:''},{...v,email:'bad'},{...v,contract:''},{...v,key:'bad'},{...v,website:'bot'}])assert.equal((await run({db},request('/api/support/withdrawals','POST',invalid))).status,400)
 db.setAllowed(false);assert.equal((await run({db},request('/api/support/withdrawals','POST',v))).status,429)
 db.setAllowed(true)
 const r=await Promise.all([run({db},request('/api/support/withdrawals','POST',v)),run({db},request('/api/support/withdrawals','POST',v))])
 assert.ok(r.every(x=>x.status===200));assert.equal(db.tables.aca_support_cases.length,1);assert.equal(db.tables.aca_support_messages.length,1)
 assert.deepEqual(r[0].body.receipt,r[1].body.receipt)
})
