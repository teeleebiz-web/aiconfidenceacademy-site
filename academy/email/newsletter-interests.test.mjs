import test from 'node:test'
import assert from 'node:assert/strict'
import {INTEREST_TOPICS,subscriberInterests,routeItems,itemInterest} from './newsletter-interests.mjs'
import {syncSubscriber} from './newsletter.mjs'
import {dispatchReadyEditions} from './newsletter-delivery.mjs'

test('existing single interests and multiple selected interests retain their exact scope',()=>{
  assert.deepEqual(subscriberInterests({interest_area:'Videos'}),['Videos'])
  assert.deepEqual(subscriberInterests({interest_area:'Phase One',interests:['Videos','Books & Resources','Videos']}),['Videos','Books & Resources'])
  assert.deepEqual(subscriberInterests({interest_area:'unknown'}),[])
})
const items=[{id:'v',kind:'video'},{id:'b',kind:'book'},{id:'r',kind:'resource'},{id:'n',kind:'note'},{id:'e',kind:'note',category:'Phase One'}].map(x=>({...x,title:x.id,url:'https://aiconfidenceacademy.org/'}))
test('mixed published material routes to exactly one appropriate category',()=>{
  assert.deepEqual(routeItems(items,'Videos').map(x=>x.id),['v'])
  assert.deepEqual(routeItems(items,'Books & Resources').map(x=>x.id),['b','r'])
  assert.deepEqual(routeItems(items,'ACA updates').map(x=>x.id),['n'])
  assert.deepEqual(routeItems(items,'Phase One').map(x=>x.id),['e'])
  assert.throws(()=>itemInterest({kind:'unknown'}))
  assert.throws(()=>itemInterest({kind:'video',category:'unknown'}))
})
test('first synchronization enables only chosen topics; subsequent runs preserve native topic opt-outs',async()=>{
  const row={email:'test@example.org',status:'active',consent_at:'2026-10-09',interests:['Videos','Phase One'],activated_interests:[]}
  const changes=[]
  const db={from(name){
    assert.equal(name,'aca_update_subscriptions')
    return {update(value){return {eq:async()=>{Object.assign(row,value);return {data:{}}}}}}
  }}
  const resend={contacts:{
    get:async()=>({data:{id:'contact'}}),
    topics:{list:async()=>({data:{data:[{id:INTEREST_TOPICS.Videos,subscription:'opt_out'}]}}),update:async({topics})=>{changes.push(...topics);return {data:{}}}},
    segments:{add:async()=>({data:{}})},
  }}
  const config={testMode:true,db,resend}
  await syncSubscriber(config,row,'now')
  assert.deepEqual(changes.filter(x=>x.subscription==='opt_in').map(x=>x.id).sort(),[INTEREST_TOPICS.Videos,INTEREST_TOPICS['Phase One']].sort())
  assert.equal(row.routing_synced,true)
  changes.length=0
  await syncSubscriber(config,row,'later')
  assert.ok(!changes.some(x=>x.id===INTEREST_TOPICS.Videos),'must not resubscribe a native opt-out')
})

function dbForRouting(){
 const tables={aca_update_subscriptions:[{email:'test@example.org',status:'active',synced_at:'now',routing_synced:true}],aca_newsletter_editions:[{week:'2026-10-05',status:'draft',items}],aca_newsletter_interest_editions:[]}
 return {tables,from(name){let filters=[],action='select',value,ignore=false;const q={
  select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},neq(k,v){filters.push(r=>r[k]!==v);return q},lt(k,v){filters.push(r=>r[k]<v);return q},order(){return q},limit(){return q},
  or(){filters.push(r=>!r.synced_at||r.sync_error||r.routing_synced===false);return q},
  update(v){action='update';value=v;return q},upsert(v,opts){action='upsert';value=v;ignore=opts.ignoreDuplicates;return q},maybeSingle(){return q.then(r=>({...r,data:r.data[0]||null}))},
  then(resolve,reject){let matches=tables[name].filter(r=>filters.every(f=>f(r)));if(action==='update')matches.forEach(r=>Object.assign(r,value));if(action==='upsert'){const old=tables[name].find(r=>r.week===value.week);if(!old)tables[name].push({status:'draft',dispatch_state:'pending',...value});else if(!ignore)Object.assign(old,value)}return Promise.resolve({data:matches}).then(resolve,reject)}
 };return q}}
}
test('each category has an independent durable broadcast, matching content, and no repeat sends',async()=>{
 const db=dbForRouting(),broadcasts=[],sent=[]
 const config={db,testMode:true,resend:{broadcasts:{create:async(payload)=>{const id=String(broadcasts.length);broadcasts.push(payload);return {data:{id}}},get:async()=>({data:{status:'draft'}}),send:async(id)=>{sent.push(id);return {data:{id}}}}}}
 const settings={delivery_enabled:true,mailing_address:'TEST ADDRESS',segment_id:'aca-only',topic_id:'original',newsletter_from:'ACA <updates@example.org>'}
 const result=await dispatchReadyEditions(config,settings,'2026-10-12')
 assert.equal(Object.keys(result.categories).length,4);assert.equal(sent.length,4)
 for(const [category,id] of Object.entries(INTEREST_TOPICS)){
  const message=broadcasts.find(x=>x.topicId===id);assert.equal(message.segmentId,'aca-only');assert.equal(message.from,settings.newsletter_from)
  const expected=routeItems(items,category).map(x=>x.title)
  for(const item of items) assert.equal(message.text.includes(`\n${item.title}\n`),expected.includes(item.title))
 }
 await dispatchReadyEditions(config,settings,'2026-10-12');assert.equal(sent.length,4)
 assert.equal(db.tables.aca_newsletter_editions[0].status,'sent')
})
