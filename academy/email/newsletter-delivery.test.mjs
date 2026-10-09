import test from 'node:test'
import assert from 'node:assert/strict'
import {newsletterMessage} from './newsletter-message.mjs'
import {dispatchEdition,dispatchReadyEditions} from './newsletter-delivery.mjs'
import {sendOperationalEmail} from './operational-email.mjs'

const item={id:'video:new',kind:'video',title:'Learn & practice',url:'https://aiconfidenceacademy.org/videos/#topic-new'}
const settings={delivery_enabled:true,mailing_address:'TEST ADDRESS — preview only',segment_id:'aca-segment',topic_id:'aca-topic'}
function editionDb(row) {
  return {from(table){assert.equal(table,'aca_newsletter_editions');let payload,filters=[]
    const q={update(v){payload=v;return q},eq(k,v){filters.push(r=>r[k]===v);return q},select(){return q},maybeSingle(){return q.then(r=>({...r,data:r.data[0]||null}))},then(resolve,reject){const matches=filters.every(f=>f(row));if(matches)Object.assign(row,payload);return Promise.resolve({data:matches?[row]:[],error:null}).then(resolve,reject)}};return q
  }}
}
test('update message uses Academy links, brand colors, physical footer, and native unsubscribe',()=>{
  const message=newsletterMessage([item],settings.mailing_address)
  assert.match(message.html,/#102d50/);assert.match(message.html,/#f7f2e6/)
  assert.match(message.html,/Learn &amp; practice/);assert.match(message.html,/RESEND_UNSUBSCRIBE_URL/)
  assert.match(message.text,/TEST ADDRESS/);assert.match(message.text,/do not affect enrollment/)
  assert.throws(()=>newsletterMessage([item],''),/mailing address/)
  assert.throws(()=>newsletterMessage([{...item,url:'https://elsewhere.example/'}],'address'),/Academy links/)
})
test('disabled delivery and missing address cannot send',async()=>{
  const config={resend:{broadcasts:{create:()=>assert.fail('not allowed')}}}
  assert.equal((await dispatchEdition(config,{items:[item]},{...settings,delivery_enabled:false})).held,'delivery_not_enabled')
  assert.equal((await dispatchEdition(config,{items:[item]},{...settings,mailing_address:''})).held,'mailing_address_required')
})
test('one broadcast is scoped to optional segment and topic and reused after submission',async()=>{
  const row={week:'2026-10-05',status:'draft',dispatch_state:'pending',items:[item]};let creates=0,sends=0,status='draft'
  const config={testMode:true,db:editionDb(row),emailFrom:'ACA <updates@example.org>',resend:{broadcasts:{
    create:async payload=>{creates++;assert.equal(payload.segmentId,'aca-segment');assert.equal(payload.topicId,'aca-topic');assert.equal(payload.send,false);return {data:{id:'broadcast-1'}}},
    get:async()=>({data:{status}}),send:async()=>{sends++;status='queued';return {data:{id:'broadcast-1'}}},
  }}}
  assert.equal((await dispatchEdition(config,{...row},settings)).submitted,true)
  assert.equal((await dispatchEdition(config,{...row},settings)).submitted,true)
  assert.equal(creates,1);assert.equal(sends,1);assert.equal(row.broadcast_id,'broadcast-1')
})
test('uncertain creation is held instead of making another broadcast',async()=>{
  const row={week:'2026-10-05',status:'draft',dispatch_state:'pending',items:[item]};let creates=0
  const config={testMode:true,db:editionDb(row),resend:{broadcasts:{create:async()=>{creates++;throw Error('network')}}}}
  assert.equal((await dispatchEdition(config,{...row},settings)).held,'needs_review')
  await dispatchEdition(config,{...row},settings);assert.equal(creates,1)
})
test('concurrent worker cannot recreate an already claimed edition',async()=>{
  const row={week:'2026-10-05',dispatch_state:'creating',items:[item]}
  const result=await dispatchEdition({db:editionDb(row),resend:{broadcasts:{create:()=>assert.fail('duplicate')}}},{...row},settings)
  assert.equal(result.held,'already_claimed')
})
test('pending unsubscribe or synchronization blocks dispatch',async()=>{
  const db={from(name){assert.equal(name,'aca_update_subscriptions');return {select(){return this},or(){return this},limit:async()=>({data:[{email:'pending@example.org'}]})}}}
  assert.equal((await dispatchReadyEditions({db},settings,'2026-10-12')).held,'subscriber_preferences_pending')
})
test('optional update opt-out does not gate portal, lesson, or payment notices',async()=>{
  let sent=0
  const db={from(name){assert.equal(name,'aca_email_events','operational sending must not depend on newsletter preferences');return {
    select(){return this},eq(){return this},maybeSingle:async()=>({data:null}),
    upsert(){return {select(){return this},single:async()=>({data:{id:'event',attempts:0}})}},
    update(){return {eq:async()=>({error:null})}},
  }}}
  for(const kind of ['enrollment_access','lesson_release','installment_reminder']) {
    await sendOperationalEmail({db,emailFrom:'ACA <notices@example.org>',resend:{emails:{send:async()=>{sent++;return {data:{id:'receipt'}}}}}},
      {eventKey:kind,templateKey:kind,to:'opted-out-of-news@example.org',subject:kind,html:'<p>Required account notice</p>'})
  }
  assert.equal(sent,3)
})
