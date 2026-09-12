import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { createAcademyServer } from '../server.mjs'
import { workbookIdentity, handleWorkbook } from './api.mjs'
const workbook = {key:'journey-one',version:1,title:'Workbook test fixture',pages:Array.from({length:32},(_,i)=>({number:i+1,kicker:'Practice',title:`Practice page ${i+1}`,blocks:[{type:'field',id:`field-${i+1}`,label:'My answer'}]}))}
const thirdWorkbook = {key:'journey-three',version:1,title:'Separate workbook fixture',pages:Array.from({length:26},(_,i)=>({number:i+1,kicker:'Practice',title:`Separate page ${i+1}`,blocks:[{type:'field',id:`third-${i+1}`,label:'My answer'}]}))}
const fourthWorkbook={key:'journey-four',version:2,title:'Fourth workbook fixture',pages:Array.from({length:8},(_,i)=>({number:i+1,kicker:'Practice',title:`Fourth page ${i+1}`,blocks:[{type:'field',id:`fourth-${i+1}`,label:'My answer'}]}))}
const fifthWorkbook={key:'journey-five',version:2,title:'Fifth workbook fixture',pages:Array.from({length:8},(_,i)=>({number:i+1,kicker:'Practice',title:`Fifth page ${i+1}`,blocks:[{type:'field',id:`fifth-${i+1}`,label:'My answer'}]}))}
const ids=[]
function collect(block,page) { if(block.type==='field')ids.push({id:block.id,page}); for(const item of block.items??[])collect(item,page);for(const row of block.rows??[])for(const field of row.fields)collect(field,page) }
for(const p of workbook.pages)for(const b of p.blocks)collect(b,p.number)
const field=ids.find(f=>f.page===5).id
function database(thirdLessonStatus = 'draft', lesson33Status = 'draft', lesson34Status = 'draft', lesson35Status = 'draft', lesson36Status = 'draft', lesson41Status = 'draft', lesson42Status = 'draft', lesson51Status = 'draft', lesson52Status = 'draft') {
  const records=[],writes=[]
  const db={ records,writes,auth:{async getUser(token){return token==='bad'?{error:Error('invalid')}:{data:{user:{id:token,is_anonymous:false}}}}},from(table){
    let action='read',value,filters=[]
    const query={
      select(){return query},eq(k,v){filters.push(row=>row[k]===v);return query},in(k,values){filters.push(row=>values.includes(row[k]));return query},
      insert(v){action='insert';value=v;return query},update(v){action='update';value=v;return query},
      async run(single){
        let rows
        if(table==='enrollments')rows=['learner-a','learner-b'].map(learner_id=>({learner_id,course_id:'course',status:'active',starts_at:'2020-01-01',enrolled_at:'2020-01-01',access_expires_at:null,course:{status:'published',drip_enabled:true}}))
        else if(table==='course_journeys')rows=[{id:'journey',course_id:'course',journey_number:1,status:'published'},{id:'third-journey',course_id:'course',journey_number:3,status:'published'},{id:'fourth-journey',course_id:'course',journey_number:4,status:'published'},{id:'fifth-journey',course_id:'course',journey_number:5,status:'published'}]
        else if(table==='lessons')rows=Array.from({length:6},(_,i)=>({journey_id:'journey',course_id:'course',page_id:`1.${i+1}`,status:'published',unlock_offset_days:i})).concat([{journey_id:'third-journey',course_id:'course',page_id:'3.1',status:'published',unlock_offset_days:14},{journey_id:'third-journey',course_id:'course',page_id:'3.2',status:thirdLessonStatus,unlock_offset_days:15},{journey_id:'third-journey',course_id:'course',page_id:'3.3',status:lesson33Status,unlock_offset_days:16},{journey_id:'third-journey',course_id:'course',page_id:'3.4',status:lesson34Status,unlock_offset_days:17},{journey_id:'third-journey',course_id:'course',page_id:'3.5',status:lesson35Status,unlock_offset_days:18},{journey_id:'third-journey',course_id:'course',page_id:'3.6',status:lesson36Status,unlock_offset_days:19},{journey_id:'fourth-journey',course_id:'course',page_id:'4.1',status:lesson41Status,unlock_offset_days:21},{journey_id:'fourth-journey',course_id:'course',page_id:'4.2',status:lesson42Status,unlock_offset_days:22},{journey_id:'fifth-journey',course_id:'course',page_id:'5.1',status:lesson51Status,unlock_offset_days:28},{journey_id:'fifth-journey',course_id:'course',page_id:'5.2',status:lesson52Status,unlock_offset_days:29}])
        else if(table==='aca_workbook_definitions')rows=[{course_id:'course',workbook_key:'journey-one',content:workbook},{course_id:'course',workbook_key:'journey-three',content:thirdWorkbook},{course_id:'course',workbook_key:'journey-four',content:fourthWorkbook},{course_id:'course',workbook_key:'journey-five',content:fifthWorkbook}]
        else if(table==='aca_workbook_responses')rows=records
        else throw Error(`Unexpected access: ${table}`)
        if(action!=='read') {
          writes.push(table)
          if(action==='insert'){
            if(records.some(row=>row.course_id===value.course_id&&row.scope_key===value.scope_key&&row.workbook_key===value.workbook_key))return {error:{code:'23505'}}
            records.push(structuredClone(value));return {data:structuredClone(value)}
          }
          const record=rows.find(row=>filters.every(fn=>fn(row)))
          if(!record)return {data:null}
          Object.assign(record,structuredClone(value));return {data:structuredClone(record)}
        }
        rows=rows.filter(row=>filters.every(fn=>fn(row)))
        return {data:structuredClone(single?rows[0]??null:rows)}
      },single(){return query.run(true)},maybeSingle(){return query.run(true)},then(resolve,reject){return query.run(false).then(resolve,reject)}
    };return query
  }};return db
}
async function fixture(fn) {
  const db=database(),password='workbook-test-password-at-least-24'
  const server=createAcademyServer({password,root:tmpdir(),courseId:'course',db})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const url=`http://127.0.0.1:${server.address().port}/api/academy/workbooks/journey-one`
  const headers={Authorization:'Basic '+Buffer.from('academy:'+password).toString('base64'),'X-ACA-Workbook':'1','Content-Type':'application/json'}
  const request=(method='GET',body,extra={})=>fetch(url,{method,headers:{...headers,...extra},body:body?JSON.stringify(body):undefined})
  try {await fn({db,request,url,headers})}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
}
test('workbook endpoint stays private and rejects cross-origin and unsupported writes',()=>fixture(async({request,url,db})=>{
  assert.equal((await fetch(url)).status,401)
  assert.equal((await request('GET',null,{'X-ACA-Workbook':'0'})).status,403)
  assert.equal((await request('PATCH',{}, {'Sec-Fetch-Site':'cross-site'})).status,403)
  assert.equal((await request('PATCH',{}, {'Content-Type':'text/plain'})).status,415)
  for(const method of ['POST','DELETE','PUT'])assert.equal((await request(method)).status,405)
  assert.equal(db.writes.length,0)
}))
test('owner can save, reopen and change an answer without touching curriculum',()=>fixture(async({request,db})=>{
  const initial=await (await request()).json();assert.equal(initial.revision,0);assert.equal(initial.scope,'owner-review')
  const saved=await request('PATCH',{baseRevision:0,page:6,answers:{[field]:'My first answer'}})
  assert.equal(saved.status,200);assert.match(saved.headers.get('cache-control'),/no-store/)
  const reopened=await (await request()).json();assert.equal(reopened.answers[field],'My first answer');assert.equal(reopened.last_page,6)
  const updated=await request('PATCH',{baseRevision:reopened.revision,page:7,answers:{[field]:'My improved answer'}})
  assert.equal(updated.status,200);assert.equal((await updated.json()).revision,2)
  assert.deepEqual(db.writes,['aca_workbook_responses','aca_workbook_responses'])
}))
test('learner identities are isolated from one another and owner review',()=>fixture(async({request})=>{
  await request('PATCH',{baseRevision:0,page:5,answers:{[field]:'owner private answer'}})
  const a={'X-ACA-Access-Token':'learner-a'},b={'X-ACA-Access-Token':'learner-b'}
  assert.deepEqual((await (await request('GET',null,a)).json()).answers,{})
  assert.equal((await request('PATCH',{baseRevision:0,page:5,answers:{[field]:'learner a'}},a)).status,200)
  assert.deepEqual((await (await request('GET',null,b)).json()).answers,{})
  assert.equal((await (await request('GET',null,a)).json()).answers[field],'learner a')
  assert.equal((await (await request()).json()).answers[field],'owner private answer')
  assert.equal((await request('GET',null,{'X-ACA-Access-Token':'bad'})).status,401)
  assert.equal((await request('GET',null,{'X-ACA-Access-Token':'not-enrolled'})).status,403)
}))
test('stale saves and unknown fields cannot overwrite stored work',()=>fixture(async({request})=>{
  await request('PATCH',{baseRevision:0,page:5,answers:{[field]:'keep'}})
  assert.equal((await request('PATCH',{baseRevision:1,page:5,answers:{made_up:'bad'}})).status,400)
  const stale=await request('PATCH',{baseRevision:0,page:5,answers:{[field]:'overwrite'}})
  assert.equal(stale.status,409);assert.equal((await stale.json()).current.answers[field],'keep')
  assert.equal((await request('PATCH',{baseRevision:1,page:33,answers:{}})).status,400)
  assert.equal((await request('PATCH',{baseRevision:1,page:5,answers:{[field]:'x'.repeat(4001)}})).status,400)
  assert.equal((await (await request()).json()).answers[field],'keep')
}))
test('a learner token is required when owner access was not established',async()=>{
  await assert.rejects(()=>workbookIdentity({headers:{}},database(),'course',false),{status:401})
})

test('Vercel parsed request bodies save without attempting to reread a consumed stream',async()=>{
  const db=database(); let status,output
  const res={setHeader(){},writeHead(s){status=s},end(value){output=JSON.parse(value)}}
  const patch={baseRevision:0,page:5,answers:{[field]:'saved through hosted handler'}}
  const req={method:'PATCH',headers:{'x-aca-workbook':'1','content-type':'application/json'},body:patch,async *[Symbol.asyncIterator](){throw Error('Stream already consumed')}}
  await handleWorkbook(req,res,{db,courseId:'course',ownerAuthenticated:true})
  assert.equal(status,200);assert.equal(output.answers[field],patch.answers[field])
})


test('the third workbook saves independently and cannot overwrite another journey',()=>fixture(async({request,url,headers})=>{
  await request('PATCH',{baseRevision:0,page:5,answers:{[field]:'keep the original workbook'}})
  const third=url.replace('journey-one','journey-three')
  assert.equal((await fetch(third)).status,401)
  const initial=await (await fetch(third,{headers})).json()
  assert.equal(initial.workbook.key,'journey-three');assert.equal(initial.last_page,1)
  assert.deepEqual(initial.allowedPages,[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26]);assert.deepEqual(initial.answers,{})
  const patch=body=>fetch(third,{method:'PATCH',headers,body:JSON.stringify(body)})
  assert.equal((await patch({baseRevision:0,page:2,answers:{'third-1':'my new practice'}})).status,200)
  assert.equal((await patch({baseRevision:1,page:27,answers:{}})).status,400)
  assert.equal((await patch({baseRevision:1,page:2,answers:{[field]:'wrong journey field'}})).status,400)
  const reopened=await (await fetch(third,{headers})).json()
  assert.equal(reopened.answers['third-1'],'my new practice');assert.equal(reopened.last_page,2)
  assert.equal((await (await request()).json()).answers[field],'keep the original workbook')
  assert.deepEqual((await (await fetch(third,{headers:{...headers,'X-ACA-Access-Token':'learner-a'}})).json()).answers,{})
  assert.equal((await fetch(third,{headers:{...headers,'X-ACA-Access-Token':'bad'}})).status,401)
}))


test('lesson 3.2 pages require its published lesson and preserve saved 3.1 answers',async()=>{
  const req={headers:{'x-aca-access-token':'learner-a'}}
  const locked=await workbookIdentity(req,database(),'course',false,'journey-three')
  assert.deepEqual(locked.allowedPages,[1,2,3,4,5,6])
  const db=database('published')
  const available=await workbookIdentity(req,db,'course',false,'journey-three')
  assert.deepEqual(available.allowedPages,[1,2,3,4,5,6,7,8,9,10])
  let status,output
  const res={setHeader(){},writeHead(s){status=s},end(v){output=JSON.parse(v)}}
  const headers={'x-aca-workbook':'1','content-type':'application/json','x-aca-access-token':'learner-a'}
  const save=body=>handleWorkbook({method:'PATCH',headers,body},res,{db,courseId:'course',ownerAuthenticated:false,workbookKey:'journey-three'})
  await save({baseRevision:0,page:1,answers:{'third-1':'Keep this answer'}})
  assert.equal(status,200)
  await save({baseRevision:1,page:7,answers:{'third-7':'My task-only prompt'}})
  assert.equal(status,200);assert.equal(output.answers['third-1'],'Keep this answer')
  await handleWorkbook({method:'GET',headers},res,{db,courseId:'course',ownerAuthenticated:false,workbookKey:'journey-three'})
  assert.equal(status,200);assert.equal(output.last_page,7);assert.equal(output.answers['third-7'],'My task-only prompt')
})

test('lesson 3.3 pages open only with its published lesson and retain earlier answers',async()=>{
  const headers={'x-aca-workbook':'1','content-type':'application/json','x-aca-access-token':'learner-a'}
  const locked=await workbookIdentity({headers},database('published'),'course',false,'journey-three')
  assert.deepEqual(locked.allowedPages,[1,2,3,4,5,6,7,8,9,10])
  const db=database('published','published')
  const available=await workbookIdentity({headers},db,'course',false,'journey-three')
  assert.deepEqual(available.allowedPages,[1,2,3,4,5,6,7,8,9,10,11,12,13,14])
  let status,output
  const res={setHeader(){},writeHead(s){status=s},end(v){output=JSON.parse(v)}}
  const options={db,courseId:'course',ownerAuthenticated:false,workbookKey:'journey-three'}
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:0,page:7,answers:{'third-1':'Keep first lesson','third-7':'Keep second lesson'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:1,page:14,answers:{'third-11':'My reader','third-14':'My reflection'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'GET',headers},res,options)
  assert.equal(status,200);assert.equal(output.last_page,14)
  assert.equal(output.answers['third-1'],'Keep first lesson')
  assert.equal(output.answers['third-7'],'Keep second lesson')
  assert.equal(output.answers['third-11'],'My reader')
  assert.equal(output.answers['third-14'],'My reflection')
})

test('lesson 3.4 pages respect availability and preserve saved earlier answers',async()=>{
  const headers={'x-aca-workbook':'1','content-type':'application/json','x-aca-access-token':'learner-a'}
  const locked=await workbookIdentity({headers},database('published','published'),'course',false,'journey-three')
  assert.deepEqual(locked.allowedPages,Array.from({length:14},(_,i)=>i+1))
  const db=database('published','published','published')
  const available=await workbookIdentity({headers},db,'course',false,'journey-three')
  assert.deepEqual(available.allowedPages,Array.from({length:18},(_,i)=>i+1))
  let status,output
  const res={setHeader(){},writeHead(s){status=s},end(v){output=JSON.parse(v)}}
  const options={db,courseId:'course',ownerAuthenticated:false,workbookKey:'journey-three'}
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:0,page:11,answers:{'third-11':'Keep earlier response'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:1,page:18,answers:{'third-15':'My limit','third-18':'My reflection'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'GET',headers},res,options)
  assert.equal(status,200);assert.equal(output.last_page,18)
  assert.equal(output.answers['third-11'],'Keep earlier response')
  assert.equal(output.answers['third-15'],'My limit')
  assert.equal(output.answers['third-18'],'My reflection')
})

test('lesson 3.5 pages respect availability and preserve saved earlier answers',async()=>{
  const headers={'x-aca-workbook':'1','content-type':'application/json','x-aca-access-token':'learner-a'}
  const locked=await workbookIdentity({headers},database('published','published','published'),'course',false,'journey-three')
  assert.deepEqual(locked.allowedPages,Array.from({length:18},(_,i)=>i+1))
  const db=database('published','published','published','published')
  const available=await workbookIdentity({headers},db,'course',false,'journey-three')
  assert.deepEqual(available.allowedPages,Array.from({length:22},(_,i)=>i+1))
  let status,output
  const res={setHeader(){},writeHead(s){status=s},end(v){output=JSON.parse(v)}}
  const options={db,courseId:'course',ownerAuthenticated:false,workbookKey:'journey-three'}
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:0,page:15,answers:{'third-15':'Keep earlier response'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:1,page:22,answers:{'third-19':'My limit','third-22':'My reflection'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'GET',headers},res,options)
  assert.equal(status,200);assert.equal(output.last_page,22)
  assert.equal(output.answers['third-15'],'Keep earlier response')
  assert.equal(output.answers['third-19'],'My limit')
  assert.equal(output.answers['third-22'],'My reflection')
})

test('lesson 3.6 pages require publication and preserve earlier saved answers',async()=>{
  const headers={'x-aca-workbook':'1','content-type':'application/json','x-aca-access-token':'learner-a'}
  const locked=await workbookIdentity({headers},database('published','published','published','published'),'course',false,'journey-three')
  assert.deepEqual(locked.allowedPages,Array.from({length:22},(_,i)=>i+1))
  const db=database('published','published','published','published','published')
  const available=await workbookIdentity({headers},db,'course',false,'journey-three')
  assert.deepEqual(available.allowedPages,Array.from({length:26},(_,i)=>i+1))
  let status,output
  const res={setHeader(){},writeHead(s){status=s},end(v){output=JSON.parse(v)}}
  const options={db,courseId:'course',ownerAuthenticated:false,workbookKey:'journey-three'}
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:0,page:19,answers:{'third-19':'Keep my earlier work'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:1,page:26,answers:{'third-23':'My recipe','third-26':'My next practice'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'GET',headers},res,options)
  assert.equal(output.last_page,26)
  assert.equal(output.answers['third-19'],'Keep my earlier work')
  assert.equal(output.answers['third-23'],'My recipe')
  assert.equal(output.answers['third-26'],'My next practice')
})


test('Journey Four workbook is private, independent and restricted to its eight pages',()=>fixture(async({request,url,headers})=>{
  await request('PATCH',{baseRevision:0,page:5,answers:{[field]:'Keep existing answers'}})
  const fourth=url.replace('journey-one','journey-four')
  assert.equal((await fetch(fourth)).status,401)
  const initial=await (await fetch(fourth,{headers})).json()
  assert.equal(initial.workbook.key,'journey-four');assert.equal(initial.last_page,1)
  assert.deepEqual(initial.allowedPages,[1,2,3,4,5,6,7,8])
  const patch=body=>fetch(fourth,{method:'PATCH',headers,body:JSON.stringify(body)})
  assert.equal((await patch({baseRevision:0,page:2,answers:{'fourth-2':'My purpose'}})).status,200)
  assert.equal((await patch({baseRevision:1,page:9,answers:{}})).status,400)
  assert.equal((await patch({baseRevision:1,page:2,answers:{[field]:'Wrong workbook'}})).status,400)
  const reopened=await (await fetch(fourth,{headers})).json()
  assert.equal(reopened.answers['fourth-2'],'My purpose')
  assert.equal((await (await request()).json()).answers[field],'Keep existing answers')
  assert.equal((await fetch(fourth,{headers:{...headers,'X-ACA-Access-Token':'bad'}})).status,401)
}))

test('4.1 workbook learner access requires the published lesson',async()=>{
  const req={headers:{'x-aca-access-token':'learner-a'}}
  await assert.rejects(()=>workbookIdentity(req,database(),'course',false,'journey-four'),{status:403})
  const available=await workbookIdentity(req,database(undefined,undefined,undefined,undefined,undefined,'published'),'course',false,'journey-four')
  assert.deepEqual(available.allowedPages,[1,2,3,4])
})

test('4.2 workbook pages require Lesson 4.2 and preserve earlier answers when saved',async()=>{
  const req={headers:{'x-aca-access-token':'learner-a'}}
  const only42=database(undefined,undefined,undefined,undefined,undefined,'draft','published')
  assert.deepEqual((await workbookIdentity(req,only42,'course',false,'journey-four')).allowedPages,[5,6,7,8])
  const db=database(undefined,undefined,undefined,undefined,undefined,'published','published')
  assert.deepEqual((await workbookIdentity(req,db,'course',false,'journey-four')).allowedPages,[1,2,3,4,5,6,7,8])
  db.records.push({course_id:'course',workbook_key:'journey-four',scope_key:'learner-a',learner_id:'learner-a',answers:{'fourth-2':'Keep my first lesson'},last_page:2,revision:1,updated_at:null})
  const headers={'x-aca-access-token':'learner-a','x-aca-workbook':'1','content-type':'application/json'}
  let status,output
  const res={setHeader(){},writeHead(code){status=code},end(value){output=JSON.parse(value)}}
  const options={db,courseId:'course',ownerAuthenticated:false,workbookKey:'journey-four'}
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:1,page:8,answers:{'fourth-5':'My purpose','fourth-8':'My card'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'GET',headers},res,options)
  assert.equal(status,200)
  assert.equal(output.last_page,8)
  assert.equal(output.answers['fourth-2'],'Keep my first lesson')
  assert.equal(output.answers['fourth-5'],'My purpose')
  assert.equal(output.answers['fourth-8'],'My card')
})

test('Journey Five workbook is private, separate, and opens only with published Lesson 5.1',()=>fixture(async({request,url,headers})=>{
  const fifth=url.replace('journey-one','journey-five')
  assert.equal((await fetch(fifth)).status,401)
  const initial=await (await fetch(fifth,{headers})).json()
  assert.equal(initial.workbook.key,'journey-five')
  assert.deepEqual(initial.allowedPages,[1,2,3,4,5,6,7,8])
  const patch=body=>fetch(fifth,{method:'PATCH',headers,body:JSON.stringify(body)})
  assert.equal((await patch({baseRevision:0,page:3,answers:{'fifth-3':'My corrected plan'}})).status,200)
  assert.equal((await patch({baseRevision:1,page:9,answers:{}})).status,400)
  assert.equal((await patch({baseRevision:1,page:3,answers:{[field]:'Wrong workbook'}})).status,400)
  assert.equal((await (await request()).json()).answers[field],undefined)
}))

test('Journey Five learner access requires published Lesson 5.1',async()=>{
  const req={headers:{'x-aca-access-token':'learner-a'}}
  await assert.rejects(()=>workbookIdentity(req,database(),'course',false,'journey-five'),{status:403})
  const available=await workbookIdentity(req,database(undefined,undefined,undefined,undefined,undefined,undefined,undefined,'published'),'course',false,'journey-five')
  assert.deepEqual(available.allowedPages,[1,2,3,4])
})

test('Lesson 5.2 opens only its four workbook pages and preserves Lesson 5.1 answers',async()=>{
  const req={headers:{'x-aca-access-token':'learner-a'}}
  const only52=database(undefined,undefined,undefined,undefined,undefined,undefined,undefined,'draft','published')
  assert.deepEqual((await workbookIdentity(req,only52,'course',false,'journey-five')).allowedPages,[5,6,7,8])
  const db=database(undefined,undefined,undefined,undefined,undefined,undefined,undefined,'published','published')
  assert.deepEqual((await workbookIdentity(req,db,'course',false,'journey-five')).allowedPages,[1,2,3,4,5,6,7,8])
  db.records.push({course_id:'course',workbook_key:'journey-five',scope_key:'learner-a',learner_id:'learner-a',answers:{'fifth-2':'Keep my 5.1 work'},last_page:2,revision:1,updated_at:null})
  const headers={'x-aca-access-token':'learner-a','x-aca-workbook':'1','content-type':'application/json'}
  let status,output
  const res={setHeader(){},writeHead(code){status=code},end(value){output=JSON.parse(value)}}
  const options={db,courseId:'course',ownerAuthenticated:false,workbookKey:'journey-five'}
  await handleWorkbook({method:'PATCH',headers,body:{baseRevision:1,page:8,answers:{'fifth-5':'My source','fifth-8':'My explanation'}}},res,options)
  assert.equal(status,200)
  await handleWorkbook({method:'GET',headers},res,options)
  assert.equal(output.answers['fifth-2'],'Keep my 5.1 work')
  assert.equal(output.answers['fifth-8'],'My explanation')
})
