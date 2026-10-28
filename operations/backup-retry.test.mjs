import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { backupSourceFetch, sourceReadFailure, sourceRetryEvidence } from './backup-failure.mjs'
import { retryBackup, isolatedRetry, liveRetryEnabled } from './backup-retry.mjs'
import { manualBackup, manualRetryEvidence } from './manual-backup.mjs'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const saved = {liveAcaBackup:true,uploadedAndReadbackVerified:true,savedCopyDecryptionVerified:true,restoredWithOriginalHashesVerified:true,reference:'aca-backups/12345678-1234-4123-8123-123456789abc',fileCount:1,totalBytes:1,encryptedBytes:9}
const time = Date.parse('2026-10-28T08:00:00Z')
async function captured(header = null) {
 const client = createClient('https://ymmkodlifpxutynpjnxm.supabase.co','fixture', { auth: { persistSession:false }, global: { fetch: backupSourceFetch(async () => new Response('PRIVATE', {status:503,headers:header === null ? {} : {'retry-after':header}}),{captureRetry:true,now:()=>time}) } })
 return sourceReadFailure((await client.storage.listBuckets()).error,'source_list')
}
async function fixture() {
 const error = await captured(); let clock=time, attempts=0, states=0, reservations=0; const outcomes=[]
 const state={policy_enabled:true,retry_enabled:true,credential_expires_at:'2026-11-01T00:00:00Z',run_valid:true,active_count:1,history_healthy:true,quota_day:'2026-10-28',run_attempts:0,day_attempts:0,unresolved_claims:0}
 const facts={stage:'source-snapshot',failedAt:time,privateStoreTouched:false,cleanupCompleted:true,sourceLimitBytes:2*1024**3,encryptedLimitBytes:2*1024**3,providerNotBefore:time}
 const env={GITHUB_REPOSITORY:'teeleebiz-web/aiconfidenceacademy-site',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_NAME:'schedule',GITHUB_RUN_ID:'123'}
 const options={error,env,runId:'fixture',deadlineAt:time+1800000,enabled:true,now:()=>clock,sleep:async ms=>{clock+=ms},evidenceFor:()=>facts,
 db:{async rpc(name,args){if(name==='aca_backup_retry_state'){states++;return {data:{...state}}}if(name==='aca_reserve_backup_retry'){reservations++;return {data:{reserved:true,id:'claim',quota_day:state.quota_day}}}if(name==='aca_begin_backup_retry')return {data:{started:true,deadline_at:new Date(clock+600000).toISOString()}};outcomes.push(args.p_outcome);return {data:{recorded:true}}}},
 runAttempt:async()=>{attempts++;return saved}}
 return {options,state,facts,outcomes,get clock(){return clock},get attempts(){return attempts},get states(){return states},get reservations(){return reservations}}
}
test('disabled production gate preserves the original failure without queries or attempts',async()=>{
 const f=await fixture();delete f.options.enabled; assert.equal(liveRetryEnabled,false)
 await assert.rejects(retryBackup(f.options),e=>e===f.options.error);assert.equal(f.states,0);assert.equal(f.attempts,0)
})
test('owned SDK transport captures absent, numeric, HTTP-date and invalid provider backoff without bodies',async()=>{
 for(const [header,expected] of [[null,time],['600',time+600000],['Wed, 28 Oct 2026 08:12:00 GMT',time+720000],['invalid',null],['9999999999999999',null]]) {
  const evidence=sourceRetryEvidence(await captured(header));assert.equal(evidence.providerNotBefore,expected);assert.doesNotMatch(JSON.stringify(evidence),/PRIVATE/)
 }
 assert.equal(sourceRetryEvidence(new Error('503')),null)
})
test('cooldown is waited and fresh policy/history are read before one reserved attempt',async()=>{
 const f=await fixture();assert.deepEqual(await retryBackup(f.options),saved);assert.equal(f.clock,time+300000);assert.equal(f.states,2);assert.equal(f.reservations,1);assert.equal(f.attempts,1);assert.deepEqual(f.outcomes,['completed'])
})
test('policy revocation during wait, overlap, quotas and missing backoff fail closed',async()=>{
 for(const [field,value] of [['retry_enabled',false],['active_count',2],['run_attempts',1],['day_attempts',1],['unresolved_claims',1],['history_healthy',false]]){
  const f=await fixture(), sleep=f.options.sleep; f.options.sleep=async ms=>{await sleep(ms);f.state[field]=value};await assert.rejects(retryBackup(f.options));assert.equal(f.attempts,0);assert.equal(f.reservations,0)
 }
 const f=await fixture();f.facts.providerNotBefore=null;await assert.rejects(retryBackup(f.options));assert.equal(f.states,0)
})
test('reservation ambiguity or denial cannot run; failed child consumes the claim without a second attempt',async()=>{
 for(const mode of ['lost','denied','child']){
  const f=await fixture(),rpc=f.options.db.rpc
  f.options.db.rpc=async(name,args)=>{if(name==='aca_reserve_backup_retry'&&mode!=='child')return mode==='lost'?{error:Error('PRIVATE')}:{data:{reserved:false}};return rpc(name,args)}
  if(mode==='child')f.options.runAttempt=async()=>{throw Error('PRIVATE')}
  await assert.rejects(retryBackup(f.options));assert.equal(f.reservations,mode==='child'?1:0);assert.equal(f.attempts,0);if(mode==='child')assert.deepEqual(f.outcomes,['failed'])
 }
})
test('actual manual wrapper records cleanup and no private-store activity with real SDK backoff',async()=>{
 const env={ACA_BACKUP_OWNER_KEY_SAVED:'true',ACA_BACKUP_SOURCE_ACCESS_CONFIRMED:'true',ACA_BACKUP_KEY_BASE64:Buffer.alloc(32,7).toString('base64'),ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY:'fixture',ACA_R2_PRIVATE_CONFIRMED:`${'a'.repeat(32)}/aca-private-backups`,ACA_R2_ACCESS_KEY_ID:'fixture',ACA_R2_SECRET_ACCESS_KEY:'fixture'}
 let privateCalls=0
 await assert.rejects(manualBackup({env,now:()=>time,availableBytes:async()=>10n*1024n**3n,createStore:()=>{privateCalls++;throw Error()},createSource:(url,key,opts)=>createClient(url,key,{...opts,global:{fetch:backupSourceFetch(async()=>new Response('PRIVATE',{status:503,headers:{'retry-after':'600'}}),{captureRetry:true,now:()=>time})}})}),error=>{
  const facts=manualRetryEvidence(error);assert.equal(facts.stage,'source-snapshot');assert.equal(facts.cleanupCompleted,true);assert.equal(facts.privateStoreTouched,false);assert.equal(facts.providerNotBefore,time+600000);return true
 });assert.equal(privateCalls,0)
 assert.equal(manualRetryEvidence(Object.assign(new Error(),{stage:'source-snapshot',cleanupCompleted:true})),null)
})
test('process deadline kills a blocked child and never accepts early IPC without successful exit',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aca-retry-child-test-'))
 try{const worker=join(root,'fixture.cjs');await writeFile(worker,"process.send({fixture:true});setInterval(()=>{},1000)")
  const started=Date.now();await assert.rejects(isolatedRetry({env:{},deadlineAt:started+150,worker}));assert.ok(Date.now()-started<3000)
  await writeFile(worker,"process.send({fixture:true});process.exitCode=1;process.disconnect()")
  await assert.rejects(isolatedRetry({env:{},deadlineAt:Date.now()+3000,worker}))
 }finally{await rm(root,{recursive:true,force:true})}
})

test('longer backoff, insufficient budget, expiring credentials and workflow reruns cannot bypass limits',async()=>{
 const f=await fixture();f.facts.providerNotBefore=time+600000;await retryBackup(f.options);assert.equal(f.clock,time+600000)
 for(const mode of ['budget','expiry','rerun','missing-evidence']){
  const f=await fixture()
  if(mode==='budget')f.options.deadlineAt=time+899999
  if(mode==='expiry')f.state.credential_expires_at=new Date(time+4500000).toISOString()
  if(mode==='rerun')f.options.env.GITHUB_RUN_ATTEMPT='2'
  if(mode==='missing-evidence')f.options.evidenceFor=manualRetryEvidence
  await assert.rejects(retryBackup(f.options));assert.equal(f.attempts,0);assert.equal(f.reservations,0)
 }
})
test('a cooldown crossing Bangkok midnight uses fresh quota and begins on that day',async()=>{
 const f=await fixture(),before=Date.parse('2026-10-28T16:58:00Z');let clock=before
 f.facts.failedAt=before;f.facts.providerNotBefore=before;f.options.now=()=>clock;f.options.sleep=async ms=>{clock+=ms};f.options.deadlineAt=before+1800000;f.state.quota_day='2026-10-29'
 await retryBackup(f.options);assert.equal(clock,before+300000);assert.equal(f.attempts,1)
})
test('incomplete recovery never records completed and cannot cause a further retry',async()=>{
 const f=await fixture();let attempts=0;f.options.runAttempt=async()=>{attempts++;return {...saved,restoredWithOriginalHashesVerified:false}}
 await assert.rejects(retryBackup(f.options));assert.equal(attempts,1);assert.deepEqual(f.outcomes,['failed'])
})
test('a changed start day or lost begin response leaves no executing child',async()=>{
 for(const mode of ['day','begin']){
  const f=await fixture(),rpc=f.options.db.rpc
  f.options.db.rpc=async(name,args)=>{if(name==='aca_reserve_backup_retry'&&mode==='day')return {data:{reserved:true,id:'claim',quota_day:'2026-10-29'}};if(name==='aca_begin_backup_retry'&&mode==='begin')return {error:Error('PRIVATE')};return rpc(name,args)}
  await assert.rejects(retryBackup(f.options));assert.equal(f.attempts,0);assert.deepEqual(f.outcomes,['failed'])
 }
})
