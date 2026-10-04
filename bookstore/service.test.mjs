import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { bookUser, bookDownload, createBookCheckout, fulfillBookSession } from './service.mjs'
import { handleBookstore } from './http.mjs'

const editionId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const fileId='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const user={id:'buyer-a',email:'buyer@example.test',email_confirmed_at:'2026-10-04'}
function dbFake(rows={}) {
  const calls=[]
  return { calls,
    auth:{getUser:async()=>({data:{user}})},
    from(table) {
      const filters={};let write
      const q={select(){return q},eq(k,v){filters[k]=v;return q},limit(){return q},order(){return q},
        insert(v){write=v;return q},update(v){write=v;return q},
        maybeSingle(){calls.push({table,filters,write});return Promise.resolve({data:rows[table]??null})},
        then(resolve,reject){calls.push({table,filters,write});return Promise.resolve({data:rows[table]??[]}).then(resolve,reject)}}
      return q
    },
    storage:{from(bucket){return {createSignedUrl:async(path,seconds,options)=>{calls.push({bucket,path,seconds,options});return {data:{signedUrl:'https://storage.example.test/signed'}}}}}},
    rpc:async(name,args)=>{calls.push({name,args});return {data:true}},
  }
}
test('requires server verified account and rejects anonymous users',async()=>{
  const db=dbFake();await assert.rejects(bookUser(db,''),{status:401})
  db.auth.getUser=async()=>({data:{user:{...user,is_anonymous:true}}})
  await assert.rejects(bookUser(db,'Bearer token'),{status:401})
  db.auth.getUser=async()=>({error:new Error('expired')})
  await assert.rejects(bookUser(db,'Bearer token'),{status:401})
})
test('closed sales never call Stripe',async()=>{
  await assert.rejects(createBookCheckout({salesEnabled:false},user,editionId),{status:503})
})
test('draft or unpriced editions cannot open checkout',async()=>{
  const db=dbFake();await assert.rejects(createBookCheckout({db,salesEnabled:true,stripe:{},webhookSecret:'configured',livemode:false},user,editionId),{status:409})
})
test('an edition with no delivery file cannot open checkout',async()=>{
  const db=dbFake({aca_book_editions:{id:editionId,stripe_test_price_id:'price',amount:900}})
  await assert.rejects(createBookCheckout({db,salesEnabled:true,stripe:{},webhookSecret:'configured',livemode:false},user,editionId),{status:409})
})
test('a Stripe price mismatch cannot charge the buyer',async()=>{
  const db=dbFake({aca_book_editions:{id:editionId,stripe_test_price_id:'price',amount:900,currency:'usd'},aca_book_files:[{id:fileId}]})
  const stripe={prices:{retrieve:async()=>({active:true,type:'one_time',unit_amount:1000,currency:'usd',livemode:false})}}
  await assert.rejects(createBookCheckout({db,stripe,salesEnabled:true,webhookSecret:'configured',livemode:false},user,editionId),{status:409})
  assert.equal(db.calls.some(c=>c.table==='aca_book_orders'),false)
})
test('approved checkout uses only the server price and binds the verified buyer',async()=>{
  const db=dbFake({aca_book_editions:{id:editionId,stripe_test_price_id:'price',amount:900,currency:'usd'},aca_book_files:[{id:fileId}]})
  let parameters
  const stripe={prices:{retrieve:async()=>({active:true,type:'one_time',unit_amount:900,currency:'usd',livemode:false})},checkout:{sessions:{create:async p=>{parameters=p;return {id:'session',url:'https://checkout.stripe.com/test'}}}}}
  await createBookCheckout({db,stripe,salesEnabled:true,webhookSecret:'configured',livemode:false,websiteUrl:'https://aiconfidenceacademy.org'},user,editionId)
  const order=db.calls.find(c=>c.table==='aca_book_orders' && c.write?.buyer_email).write
  assert.equal(order.user_id,user.id);assert.equal(order.amount,900)
  assert.deepEqual(parameters.line_items,[{price:'price',quantity:1}]);assert.equal(parameters.client_reference_id,order.id)
  assert.equal(parameters.customer_email,user.email);assert.equal(parameters.mode,'payment')
  assert.equal('payment_method_types' in parameters,false)
})
test('downloads enforce buyer ownership and live versus sandbox access',async()=>{
  const db=dbFake({aca_book_files:{id:fileId,edition_id:editionId,object_path:'book/chapter.mp3'}})
  await assert.rejects(bookDownload({db,livemode:true},{...user,id:'buyer-b'},fileId),{status:403})
  const access=db.calls.find(c=>c.table==='aca_book_access')
  assert.equal(access.filters.user_id,'buyer-b');assert.equal(access.filters.livemode,true)
  assert.equal(db.calls.some(c=>c.bucket),false)
})
test('revoked or unpaid orders do not receive signed downloads',async()=>{
  const db=dbFake({aca_book_files:{id:fileId,edition_id:editionId,object_path:'book.pdf'},aca_book_access:{order_id:'order'},aca_book_orders:{status:'refunded'}})
  await assert.rejects(bookDownload({db,livemode:true},user,fileId),{status:403})
  assert.equal(db.calls.some(c=>c.bucket),false)
})
test('paid purchaser receives a five minute private download',async()=>{
  const db=dbFake({aca_book_files:{id:fileId,edition_id:editionId,object_path:'book.pdf'},aca_book_access:{order_id:'order'},aca_book_orders:{status:'paid'}})
  const download=await bookDownload({db,livemode:true},user,fileId)
  assert.equal(download.expiresIn,300)
  assert.deepEqual(db.calls.find(c=>c.bucket),{bucket:'aca-bookstore-files',path:'book.pdf',seconds:300,options:{download:true}})
})
test('unpaid or wrong environment sessions never grant access',async()=>{
  for(const session of [{mode:'payment',payment_status:'unpaid',livemode:false},{mode:'payment',payment_status:'paid',livemode:true}]){
    const db=dbFake();const config={db,livemode:false,stripe:{checkout:{sessions:{retrieve:async()=>session}}}}
    assert.deepEqual(await fulfillBookSession(config,'session'),{fulfilled:false});assert.equal(db.calls.length,0)
  }
})
test('mismatched purchased edition is rejected before the atomic grant',async()=>{
  const db=dbFake({aca_book_orders:{id:'order',price_id:'correct'}})
  const session={id:'session',mode:'payment',payment_status:'paid',livemode:false,client_reference_id:'order',metadata:{aca_book_order:'order'},line_items:{data:[{quantity:1,price:{id:'wrong'}}]}}
  await assert.rejects(fulfillBookSession({db,livemode:false,stripe:{checkout:{sessions:{retrieve:async()=>session}}}},'session'),{status:400})
  assert.equal(db.calls.some(c=>c.name),false)
})
test('valid payment reaches transactional fulfillment with verified totals',async()=>{
  const db=dbFake({aca_book_orders:{id:'order',price_id:'correct'}})
  const session={id:'session',mode:'payment',payment_status:'paid',livemode:false,client_reference_id:'order',metadata:{aca_book_order:'order'},line_items:{data:[{quantity:1,price:{id:'correct'}}]},payment_intent:'intent',amount_total:900,currency:'usd'}
  assert.deepEqual(await fulfillBookSession({db,livemode:false,stripe:{checkout:{sessions:{retrieve:async()=>session}}}},'session'),{fulfilled:true})
  assert.deepEqual(db.calls.find(c=>c.name).args,{p_order_id:'order',p_session_id:'session',p_payment_intent_id:'intent',p_amount:900,p_currency:'usd',p_livemode:false})
  assert.ok(db.calls.every(c=>!c.table || c.table.startsWith('aca_book_')))
})
test('HTTP denies invalid signatures and keeps internal errors private',async()=>{
  const req=Readable.from(['{}']);req.method='POST';req.headers={'stripe-signature':'wrong'}
  let status,body;const res={writeHead(s){status=s},end(b){body=JSON.parse(b)}}
  await handleBookstore(req,res,{db:dbFake(),webhookSecret:'configured',stripe:{webhooks:{constructEvent(){throw Error('secret')}}}},'webhook')
  assert.equal(status,400);assert.equal(body.error,'Invalid payment event.')
})
