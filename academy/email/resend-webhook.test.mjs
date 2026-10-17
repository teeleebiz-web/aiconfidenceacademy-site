import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { handleResendWebhook, recordResendEvent } from './resend-webhook.mjs'

function database(existing = { id: 'mail-1', status: 'sent' }, beforeWrite = async () => {}) {
  const writes = []
  const row=existing?{provider_message_id:'provider-1',...existing}:null
  return {
    writes,row,
    from() {
      let value;const filters=[]
      const query={
        select() { return query },
        eq(key,expected) { filters.push(r=>r[key]===expected);return query },
        in(key,expected) { filters.push(r=>expected.includes(r[key]));return query },
        async maybeSingle(){
          if(value)await beforeWrite(value,row)
          if(!row||!filters.every(f=>f(row)))return {data:null,error:null}
          if(value){writes.push(value);Object.assign(row,value)}
          return {data:{...row},error:null}
        },
        update(next) { value=next;return query },
      }
      return query
    },
  }
}

const event = (type, extra = {}) => ({
  type,
  created_at: '2026-09-18T20:00:00.000Z',
  data: { email_id: 'provider-1', ...extra },
})

test('records a delivered email with the provider timestamp', async () => {
  const db = database()
  const result = await recordResendEvent({ db }, event('email.delivered'))
  assert.equal(result.status, 'delivered')
  assert.deepEqual(db.writes[0], {
    status: 'delivered', delivered_at: '2026-09-18T20:00:00.000Z', last_error: null,
  })
})

test('records provider failure details for operations review', async () => {
  const db = database()
  await recordResendEvent({ db }, event('email.bounced', { bounce: { message: 'Mailbox unavailable' } }))
  assert.deepEqual(db.writes[0], { status: 'bounced', last_error: 'Mailbox unavailable' })
})

test('does not regress delivered email when a late sent event arrives', async () => {
  const db = database({ id: 'mail-1', status: 'delivered' })
  const result = await recordResendEvent({ db }, event('email.sent'))
  assert.equal(result.duplicate, true)
  assert.equal(db.writes.length, 0)
})

test('concurrent callbacks cannot overwrite delivery after an earlier sent lookup',async()=>{
 let release;const blocked=new Promise(resolve=>{release=resolve});let started
 const waiting=new Promise(resolve=>{started=resolve})
 const db=database(undefined,async value=>{if(value.status==='sent'){started();await blocked}})
 const sent=recordResendEvent({db},event('email.sent'))
 await waiting
 await recordResendEvent({db},event('email.delivered'))
 release();assert.equal((await sent).duplicate,true)
 assert.equal(db.row.status,'delivered');assert.equal(db.row.delivered_at,event().created_at)
 assert.equal(db.writes.length,1)
})

test('a delivery callback cannot erase a failure committed after its lookup',async()=>{
 let release,started;const blocked=new Promise(resolve=>{release=resolve}),waiting=new Promise(resolve=>{started=resolve})
 const db=database(undefined,async value=>{if(value.status==='delivered'){started();await blocked}})
 const delivered=recordResendEvent({db},event('email.delivered'));await waiting
 await recordResendEvent({db},event('email.bounced',{bounce:{message:'Mailbox unavailable'}}))
 release();assert.equal((await delivered).duplicate,true)
 assert.equal(db.row.status,'bounced');assert.equal(db.row.last_error,'Mailbox unavailable')
})

test('duplicate delivery preserves the recorded provider timestamp',async()=>{
 const timestamp='2026-09-18T19:59:00.000Z',db=database({id:'mail-1',status:'delivered',delivered_at:timestamp})
 assert.equal((await recordResendEvent({db},event('email.delivered'))).duplicate,true)
 assert.equal(db.row.delivered_at,timestamp);assert.equal(db.writes.length,0)
})

test('a callback for an old provider message cannot overwrite a newer send attempt',async()=>{
 const db=database(undefined,async(_value,row)=>{row.provider_message_id='provider-2'})
 assert.equal((await recordResendEvent({db},event('email.delivered'))).duplicate,true)
 assert.equal(db.row.status,'sent');assert.equal(db.writes.length,0)
})

test('ignores provider events that are not ACA operational email records', async () => {
  const db = database(null)
  const result = await recordResendEvent({ db }, event('email.delivered'))
  assert.equal(result.ignored, true)
  assert.equal(db.writes.length, 0)
})

test('rejects webhook payloads with an invalid signature', async () => {
  const request = new EventEmitter()
  request.method = 'POST'
  request.headers = { 'svix-id': 'id', 'svix-timestamp': 'time', 'svix-signature': 'bad' }
  const response = {
    status: null, payload: '',
    writeHead(status) { this.status = status },
    end(chunk = '') { this.payload += chunk },
  }
  const config = {
    db: database(), resendWebhookSecret: 'secret',
    resend: { webhooks: { verify() { throw new Error('invalid') } } },
  }
  const promise = handleResendWebhook(request, response, config)
  request.emit('data', Buffer.from('{}'))
  request.emit('end')
  await promise
  assert.equal(response.status, 400)
  assert.deepEqual(JSON.parse(response.payload), { error: 'Invalid webhook signature' })
})
