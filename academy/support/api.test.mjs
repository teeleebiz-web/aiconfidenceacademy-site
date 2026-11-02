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
