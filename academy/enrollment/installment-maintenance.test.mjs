import assert from 'node:assert/strict'
import test from 'node:test'
import { handleInstallmentMaintenance, isInstallmentReminderDue } from './installment-maintenance.mjs'

test('daily run covers every payment hour two local calendar days ahead', () => {
  const now = new Date('2026-10-08T09:00:00Z')
  for (let hour = 0; hour < 24; hour++) {
    const due = new Date(Date.UTC(2026, 9, 10, hour + 7, 14, 42))
    assert.equal(isInstallmentReminderDue(due, now), true, `payment hour ${hour}`)
    assert.equal(isInstallmentReminderDue(due, new Date('2026-10-07T09:00:00Z')), false)
  }
})

test('handles local calendar boundaries and daylight-saving changes', () => {
  for (const [run, due] of [
    ['2026-10-30T09:00:00Z', '2026-11-02T07:59:00Z'],
    ['2026-03-06T09:00:00Z', '2026-03-09T06:59:00Z'],
    ['2026-12-30T09:00:00Z', '2027-01-02T07:59:00Z'],
  ]) assert.equal(isInstallmentReminderDue(due, new Date(run)), true)
})

test('retries missed reminders before payment without selecting past or distant payments', () => {
  const now = new Date('2026-10-09T09:00:00Z')
  assert.equal(isInstallmentReminderDue('2026-10-10T19:14:42Z', now), true)
  assert.equal(isInstallmentReminderDue(now.toISOString(), now), false)
  assert.equal(isInstallmentReminderDue('2026-10-08T19:14:42Z', now), false)
  assert.equal(isInstallmentReminderDue('2026-10-12T07:00:00Z', now), false)
  assert.equal(isInstallmentReminderDue('invalid', now), false)
})

test('maintenance sends an off-hour reminder once and leaves later payments alone', async () => {
  const tables = {
    aca_installment_plans: [
      { id: 'due', status: 'active', next_due_at: '2026-10-10T19:14:42Z', next_amount: 5000, customer_email: 'test@example.com', reminder_sent_for_due_at: null },
      { id: 'later', status: 'active', next_due_at: '2026-10-11T12:00:00Z', next_amount: 4900, customer_email: 'test@example.com', reminder_sent_for_due_at: null },
    ],
    aca_email_events: [],
  }
  const db = { from(table) {
    const filters = []
    let update
    let recorded
    const rows = () => tables[table].filter(row => filters.every(filter => filter(row)))
    return {
      select() { return this },
      eq(key, value) { filters.push(row => row[key] === value); return this },
      gte(key, value) { filters.push(row => new Date(row[key]) >= new Date(value)); return this },
      lt(key, value) { filters.push(row => new Date(row[key]) < new Date(value)); return this },
      is(key, value) { filters.push(row => row[key] === value); return this },
      update(value) { update = value; return this },
      upsert(value) {
        recorded = tables[table].find(row => row.event_key === value.event_key)
        if (!recorded) { recorded = { id: 'email', attempts: 0 }; tables[table].push(recorded) }
        Object.assign(recorded, value)
        return this
      },
      async maybeSingle() { return { data: rows()[0] || null, error: null } },
      async single() { return { data: recorded, error: null } },
      then(resolve, reject) {
        const selected = rows()
        if (update) selected.forEach(row => Object.assign(row, update))
        return Promise.resolve({ data: selected, error: null }).then(resolve, reject)
      },
    }
  } }
  const sent = []
  const config = { db, cronSecret: 'test', emailFrom: 'ACA <test@example.com>', resend: {
    emails: { send: async message => { sent.push(message); return { data: { id: 'sent' } } } },
  } }
  const run = async () => {
    const res = { writeHead(status) { this.status = status }, end(body) { this.body = JSON.parse(body) } }
    await handleInstallmentMaintenance({ method: 'GET', headers: { authorization: 'Bearer test' } }, res, config, new Date('2026-10-08T09:00:00Z'))
    assert.equal(res.status, 200)
    return res.body
  }
  assert.equal((await run()).remindersSent, 1)
  assert.equal(sent.length, 1)
  assert.match(sent[0].html, /\$50\.00/)
  assert.equal(tables.aca_installment_plans[1].reminder_sent_for_due_at, null)
  assert.equal((await run()).remindersSent, 0)
  assert.equal(sent.length, 1)
})

function failureFixture({failure,overdue=false}={}) {
 const plan={id:'plan',enrollment_id:'enrollment',learner_id:'learner',status:overdue?'grace':'active',grace_until:'2026-10-07T09:00:00Z',next_due_at:'2026-10-10T19:14:42Z',next_amount:5000,customer_email:'fixture@example.test',reminder_sent_for_due_at:null}
 const tables={aca_installment_plans:[plan],enrollments:[{id:'enrollment',status:'active'}],aca_email_events:[]}
 let failOnce=true,sends=0
 const db={from(table){
  const filters=[];let write,insert
  const rows=()=>tables[table].filter(row=>filters.every(f=>f(row)))
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},gte(k,v){filters.push(r=>new Date(r[k])>=new Date(v));return q},lt(k,v){filters.push(r=>new Date(r[k])<new Date(v));return q},is(k,v){filters.push(r=>r[k]===v);return q},
   update(value){write=value;return q},upsert(value){insert=value;return q},
   async maybeSingle(){return {data:rows()[0]||null}},
   async single(){let row=tables[table].find(r=>r.event_key===insert.event_key);if(!row){row={id:'email',attempts:0};tables[table].push(row)}Object.assign(row,insert);return {data:row}},
   then(resolve,reject){
    const refused=failOnce&&((failure==='reminder-write'&&write?.reminder_sent_for_due_at)||(failure==='enrollment-write'&&table==='enrollments'&&write)||(failure==='plan-write'&&table==='aca_installment_plans'&&write?.status==='paused'))
    if(refused){failOnce=false;return Promise.resolve({error:Error('private database detail')}).then(resolve,reject)}
    const found=rows();if(write)found.forEach(r=>Object.assign(r,write));return Promise.resolve({data:found,error:null}).then(resolve,reject)
   }};return q
 }}
 const config={db,cronSecret:'fixture',emailFrom:'ACA <fixture@example.test>',resend:{emails:{send:async()=>{sends++;if(failure==='provider'&&failOnce){failOnce=false;return {error:{message:'private provider detail'}}}return {data:{id:'provider-fixture'}}}}}}
 const run=async()=>{const res={writeHead(status){this.status=status},end(value){this.body=JSON.parse(value)}};await handleInstallmentMaintenance({method:'GET',headers:{authorization:'Bearer fixture'}},res,config,new Date('2026-10-08T09:00:00Z'));assert.equal(res.status,200);return res.body}
 return {plan,tables,run,get sends(){return sends}}
}

test('provider failure is counted and a later run retries the unsent reminder',async()=>{
 const f=failureFixture({failure:'provider'}),failed=await f.run()
 assert.equal(failed.failed,1);assert.equal(failed.reminderFailures,1);assert.equal(failed.remindersSent,0);assert.equal(f.plan.reminder_sent_for_due_at,null)
 assert.doesNotMatch(JSON.stringify(failed),/private/)
 const retried=await f.run();assert.equal(retried.failed,0);assert.equal(retried.remindersSent,1);assert.equal(retried.remindersRecorded,1);assert.equal(f.sends,2)
})

test('retry after a reminder marker write fails records the prior send without another email',async()=>{
 const f=failureFixture({failure:'reminder-write'}),failed=await f.run()
 assert.equal(failed.failed,1);assert.equal(failed.remindersSent,1);assert.equal(failed.remindersRecorded,0);assert.equal(f.plan.reminder_sent_for_due_at,null)
 const retried=await f.run();assert.equal(retried.failed,0);assert.equal(retried.remindersSent,0);assert.equal(retried.remindersRecorded,1);assert.equal(f.sends,1)
 assert.equal(f.plan.next_due_at,'2026-10-10T19:14:42Z');assert.equal(f.plan.reminder_sent_for_due_at,f.plan.next_due_at)
})

test('partial access-pause writes are counted as failures and remain eligible for the next run',async()=>{
 for(const failure of ['enrollment-write','plan-write']){
  const f=failureFixture({failure,overdue:true}),failed=await f.run()
  assert.equal(failed.failed,1);assert.equal(failed.pauseFailures,1);assert.equal(failed.accessPaused,0);assert.equal(f.plan.status,'grace')
  const retried=await f.run();assert.equal(retried.failed,0);assert.equal(retried.accessPaused,1);assert.equal(f.plan.status,'paused');assert.equal(f.tables.enrollments[0].status,'paused');assert.equal(f.sends,0)
 }
})
