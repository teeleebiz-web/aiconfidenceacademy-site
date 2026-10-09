import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {videoCatalog,weekKey,syncSubscriber,prepareEdition,runNewsletterMaintenance,handleNewsletterMaintenance,handleNewsletterUnsubscribe} from './newsletter.mjs'

function database(initial={}) {
  const tables=structuredClone(initial)
  return {tables,from(name){
    tables[name] ||= []; let filters=[],action='select',payload
    const query={select(){return query},eq(k,v){filters.push(r=>r[k]===v);return query},update(v){action='update';payload=v;return query},insert(v){action='insert';payload=v;return query},upsert(v){action='upsert';payload=v;return query},maybeSingle(){return query.then(r=>({...r,data:r.data?.[0]||null}))},then(resolve,reject){
      try {const matches=tables[name].filter(r=>filters.every(f=>f(r)))
        if(action==='update') matches.forEach(r=>Object.assign(r,payload))
        if(action==='insert') tables[name].push(structuredClone(payload))
        if(action==='upsert'){const key='week' in payload?'week':'id';const old=tables[name].find(r=>r[key]===payload[key]);if(old)Object.assign(old,payload);else tables[name].push(structuredClone(payload))}
        return Promise.resolve({data:matches,error:null}).then(resolve,reject)
      }catch(e){return Promise.reject(e).then(resolve,reject)}
    }};return query
  }}
}
const reply=()=>({writeHead(code,headers){this.code=code;this.headers=headers},end(body){this.body=body}})
test('disabled importing leaves every existing contact and test record untouched',async()=>{
  const original=[{id:1,email:'integration@example.org',status:'active'}]
  const db=database({aca_interest_list:original,aca_newsletter_state:[{id:'settings',value:{contact_sync_enabled:false}}]})
  const result=await runNewsletterMaintenance({db,resend:{contacts:{get:()=>assert.fail('must not import')}}},[{id:'video:a'}])
  assert.equal(result.checked,0);assert.equal(result.contact_sync_enabled,false)
  assert.deepEqual(db.tables.aca_interest_list,original)
})
test('catalog reads all ten published instructor and demonstration videos with stable links',async()=>{
  const items=videoCatalog(await readFile(new URL('../../videos/index.html',import.meta.url),'utf8'))
  assert.equal(items.length,10);assert.ok(items.some(v=>v.id==='video:topic-what-is-ai'));assert.ok(items.some(v=>v.id==='video:explore-video-04'));assert.equal(new Set(items.map(v=>v.id)).size,10)
})
test('weekly grouping uses Monday UTC including Sunday and year boundary',()=>{
  assert.equal(weekKey(new Date('2026-10-11T23:00Z')),'2026-10-05')
  assert.equal(weekKey(new Date('2027-01-01T01:00Z')),'2026-12-28')
})
test('first run baselines old videos; new videos create one weekly draft; repeat does not duplicate',async()=>{
  const db=database(),a={id:'a',title:'Existing'},b={id:'b',title:'New'}
  assert.equal((await prepareEdition(db,[a])).baseline,1)
  assert.equal(db.tables.aca_newsletter_editions,undefined)
  assert.equal((await prepareEdition(db,[a,b])).added,1)
  assert.equal((await prepareEdition(db,[a,b])).added,0)
  assert.equal(db.tables.aca_newsletter_editions[0].items.length,1)
})
test('approved editions are not rewritten and new items remain pending',async()=>{
  const db=database({aca_newsletter_state:[{id:'catalog',value:['a']}],aca_newsletter_editions:[{week:weekKey(),status:'approved',items:[{id:'a'}]}]})
  assert.equal((await prepareEdition(db,[{id:'a'},{id:'b'}])).pending,1)
  assert.deepEqual(db.tables.aca_newsletter_state[0].value,['a'])
})
test('unsubscribed provider contact stays unsubscribed and leaves only the academy segment',async()=>{
  const row={id:1,email:'learner@example.org',status:'active',consent:true};const db=database({aca_interest_list:[row]});let removed=0
  const resend={contacts:{get:async()=>({data:{id:'contact',unsubscribed:true}}),segments:{remove:async()=>{removed++;return {data:{}}}},create:()=>assert.fail('must not recreate')}}
  assert.equal(await syncSubscriber({db,resend},row,new Date().toISOString()),'unsubscribed')
  assert.equal(removed,1);assert.equal(db.tables.aca_interest_list[0].status,'unsubscribed')
})
test('test entries and absent consent never touch provider',async()=>{
  assert.equal(await syncSubscriber({}, {newsletter_excluded:true,consent:true}), 'excluded')
  assert.equal(await syncSubscriber({}, {consent:false}), 'excluded')
})
test('provider error does not create duplicate contact or report sync success',async()=>{
  const config={resend:{contacts:{get:async()=>({error:{statusCode:403}})}}}
  await assert.rejects(()=>syncSubscriber(config,{consent:true,status:'active'}))
})
test('maintenance cannot run without cron authorization',async()=>{
  const res=reply();await handleNewsletterMaintenance({method:'GET',headers:{}},res,{cronSecret:'secret',db:{},resend:{}},'')
  assert.equal(res.code,401)
})
test('unsubscribe GET is nonmutating; POST opts out without changing learning access',async()=>{
  const token='11111111-2222-4333-8444-555555555555';const db=database({aca_interest_list:[{id:1,status:'active',unsubscribe_token:token}]})
  const get=reply();await handleNewsletterUnsubscribe({method:'GET',url:'/api/email/unsubscribe',query:{token}},get,{db})
  assert.equal(db.tables.aca_interest_list[0].status,'active');assert.match(get.body,/Unsubscribe/)
  const post=reply();await handleNewsletterUnsubscribe({method:'POST',url:`/?token=${token}`},post,{db})
  assert.equal(db.tables.aca_interest_list[0].status,'unsubscribed');assert.match(post.body,/learning access is unchanged/)
})
test('malformed unsubscribe link rejected before accessing database',async()=>{
  const res=reply();await handleNewsletterUnsubscribe({method:'POST',url:'/?token=guess'},res,{})
  assert.equal(res.code,400)
})
