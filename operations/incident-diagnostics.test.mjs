import test from 'node:test'
import assert from 'node:assert/strict'
import {coordinate,validatePolicy,validateMonitor,parseAlerts,probe,statusCakeReader,targets,incidentFailureLabel} from './incident-diagnostics.mjs'
const time='2026-10-27T10:00:00.000Z',policy={enabled:true,activated_at:'2026-10-27T09:00:00Z',monitors:{website:'1',backend:'2'},contact_group:'3'}
const copy=x=>structuredClone(x)
const healthy=role=>({code:200,ready:true,readiness:role==='backend'?'ok':null,error:null})
const failed=()=>({code:503,ready:false,readiness:'unavailable',error:null})
function fixture(){
 let saved=null,reachable=true,up=false,active=copy(policy),alerts=[{id:'10',status:'down',triggered_at:'2026-10-27T09:55:00Z',status_code:503}],mirrorUp=true,clock=time
 const evidence=[],mirrors=[],writes=[]
 const options={
  now:()=>new Date(clock),pause:async()=>{},
  readPolicy:async()=>{if(!reachable)throw Error('database offline');return active},
  store:{load:async()=>copy(saved),save:async value=>{saved=copy(value);writes.push('state')},evidence:async value=>{evidence.push(copy(value));writes.push('evidence')}},
  readProvider:async(id,resource,after)=>resource?{data:id==='2'?alerts.filter(a=>Date.parse(a.triggered_at)>=after*1000):[],links:{next:null}}:{data:{id,website_url:targets[id==='1'?'website':'backend'],test_type:'HTTP',status:id==='2'&&!up?'down':'up',paused:false,check_rate:300,contact_groups:['3']}},
  check:async role=>role==='backend'&&!up?failed():healthy(role),
  mirror:async value=>{if(!mirrorUp)throw Error('database offline');mirrors.push(copy(value))},heartbeat:async()=>{if(!mirrorUp)throw Error('offline')},
 }
 return {options,evidence,mirrors,writes,get state(){return copy(saved)},offline(){reachable=false;mirrorUp=false},online(){reachable=true;mirrorUp=true},recover(){up=true;clock='2026-10-27T10:15:00Z';alerts=[...alerts,{id:'11',status:'up',triggered_at:'2026-10-27T10:12:00Z',status_code:200}]},disable(){active={enabled:false}},invalid(){active={enabled:true}},changeAlerts(v){alerts=v}}
}
test('verified event produces a private diagnostic record with fixed samples, not a claimed repair',async()=>{
 const f=fixture();const result=await coordinate(f.options)
 assert.equal(result.held,false);assert.equal(f.mirrors.length,1)
 const r=f.mirrors[0];assert.equal(r.diagnosis,'backend_readiness_failed');assert.equal(r.repair_performed,false);assert.equal(r.status,'open')
 assert.equal(r.samples.website.length,2);assert.equal(r.samples.backend.length,2);assert.match(r.id,/^[a-f0-9]{64}$/)
 assert.ok(f.writes.indexOf('evidence')<f.writes.lastIndexOf('state'))
})
test('repeated provider alerts keep one incident and recovery needs current provider and live confirmation',async()=>{
 const f=fixture();await coordinate(f.options);await coordinate(f.options);assert.equal(f.state.reports.length,1)
 f.recover();await coordinate(f.options);assert.equal(f.state.reports.length,1);const r=f.state.reports[0].report
 assert.equal(r.status,'recovered');assert.equal(r.resolved_at,'2026-10-27T10:15:00.000Z');assert.equal(r.repair_performed,false)
})
test('an up alert cannot close an incident while the provider and readiness checks still fail',async()=>{
 const f=fixture();f.changeAlerts([{id:'10',status:'down',triggered_at:'2026-10-27T09:55:00Z',status_code:503},{id:'11',status:'up',triggered_at:'2026-10-27T09:58:00Z',status_code:200}]);await coordinate(f.options);assert.equal(f.state.reports[0].report.status,'open')
})
test('cached policy and encrypted outbox continue collecting when the ACA database is unavailable, then synchronize',async()=>{
 const f=fixture();await coordinate(f.options);f.offline();f.recover();let r=await coordinate(f.options)
 assert.equal(r.synchronized,false);assert.equal(f.state.reports[0].report.status,'recovered');assert.equal(f.state.reports[0].synced,false)
 f.online();r=await coordinate(f.options);assert.equal(r.synchronized,true);assert.equal(f.state.reports[0].synced,true)
})
test('disabled or invalid fresh policy fails closed; a missing initial policy cannot be invented during an outage',async()=>{
 const f=fixture();await coordinate(f.options);f.disable();assert.deepEqual(await coordinate(f.options),{held:true});f.invalid();await assert.rejects(()=>coordinate(f.options),/activation is invalid/)
 const empty=fixture();empty.offline();await assert.rejects(()=>coordinate(empty.options),/policy is unavailable/)
})
test('activation excludes earlier events even within the same second',async()=>{
 const f=fixture();f.options.readPolicy=async()=>({...policy,activated_at:'2026-10-27T09:00:00.500Z'})
 f.changeAlerts([{id:'1',status:'down',triggered_at:'2026-10-27T09:00:00.000Z',status_code:500},{id:'2',status:'down',triggered_at:'2026-10-27T09:00:01.000Z',status_code:503}])
 await coordinate(f.options);assert.equal(f.state.reports.length,1);assert.equal(f.state.reports[0].report.source_at,'2026-10-27T09:00:01.000Z')
})
test('confirmation rounds exceed the readiness cache and paused monitors are skipped',async()=>{
 const f=fixture(),pauses=[];f.options.pause=async ms=>pauses.push(ms);await coordinate(f.options);assert.deepEqual(pauses,[16000])
 const paused=fixture(),reader=paused.options.readProvider;paused.options.readProvider=async(...args)=>{assert.equal(args[1],undefined);const result=await reader(...args);result.data.paused=true;return result}
 await coordinate(paused.options);assert.equal(paused.evidence.length,0);assert.equal(paused.mirrors.length,0)
})
test('failed durable evidence storage does not advance the event cursor or mirror a report',async()=>{
 const f=fixture();f.options.store.evidence=async()=>{throw Error('save failed')};await assert.rejects(()=>coordinate(f.options),/save failed/);assert.equal(f.mirrors.length,0);assert.deepEqual(f.state.monitors,{})
})
test('monitor identity, URL, contact group and malformed or paginated alerts cannot select arbitrary requests',()=>{
 const good={data:{id:'1',website_url:targets.website,test_type:'HTTP',status:'up',paused:false,check_rate:300,contact_groups:['3']}}
 assert.deepEqual(validateMonitor('website','1',good,policy),{status:'up',paused:false})
 for(const fields of [{id:'9'},{website_url:'http://169.254.169.254/'},{contact_groups:[]},{check_rate:900},{status:'unknown'}])assert.throws(()=>validateMonitor('website','1',{data:{...good.data,...fields}},policy))
 assert.throws(()=>validatePolicy({...policy,monitors:{website:'1',backend:'1'}}));assert.throws(()=>parseAlerts({data:[],links:{next:'https://untrusted.test/'}},0))
 assert.throws(()=>parseAlerts({data:[{id:'x',status:'down',triggered_at:time}]},0))
})
test('provider reader sends credentials only to the fixed API using GET and refuses redirects or oversized payloads',async()=>{
 const calls=[];const reader=statusCakeReader('test-token-not-a-real-key',{fetcher:async(...args)=>{calls.push(args);return new Response('{"data":[]}')}})
 await reader('1','alerts',12);assert.equal(calls[0][0],'https://api.statuscake.com/v1/uptime/1/alerts?limit=100&after=12');assert.equal(calls[0][1].method,'GET');assert.equal(calls[0][1].redirect,'error')
 await assert.rejects(()=>reader('../elsewhere'));await assert.rejects(()=>reader('1','delete'))
 const big=statusCakeReader('test-token-not-a-real-key',{fetcher:async()=>new Response('x'.repeat(140000))});await assert.rejects(()=>big('1'),/too large/)
})
test('live checks discard provider error bodies and require the exact readiness service/status',async()=>{
 let call;const result=await probe('backend',{fetcher:async(...args)=>{call=args;return new Response('{"service":"aca-backend","status":"ok"}')}})
 assert.equal(result.ready,true);assert.equal(call[0],targets.backend);assert.equal(call[1].redirect,'error')
 assert.equal((await probe('backend',{fetcher:async()=>new Response('{"service":"other","status":"ok"}')})).ready,false)
 const fail=await probe('website',{fetcher:async()=>new Response('secret private error body',{status:500})});assert.doesNotMatch(JSON.stringify(fail),/secret|private/)
 await assert.rejects(()=>probe('http://attacker.test'))
})

test('public failure labels are fixed and never contain arbitrary provider or credential text',()=>{
 assert.equal(incidentFailureLabel(new Error('Monitoring configuration needs review')),'monitor_configuration')
 assert.equal(incidentFailureLabel(new Error('Monitoring history needs pagination review')),'monitor_history_pagination')
 for(const error of [new Error('Bearer secret-token; response contains a private email'),new Error('Monitoring configuration needs review: private payload'),{message:'Monitoring configuration needs review'},null])assert.equal(incidentFailureLabel(error),'unclassified_failure')
})
