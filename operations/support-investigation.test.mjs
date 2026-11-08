import test from 'node:test'
import assert from 'node:assert/strict'
import {investigateSupport} from './support-investigation.mjs'

const claim={case_id:'00000000-0000-4000-8000-000000000001',claim_token:'00000000-0000-4000-8000-000000000002',generation:1,category:'technical'}
const good=role=>({code:200,ready:true,readiness:role==='backend'?'ok':null,error:null})
function fixture(claims=[claim]) {
  const calls=[],checks=[],pauses=[];let time=Date.parse('2026-11-08T03:00:00Z')
  return {calls,checks,pauses,options:{
    db:{rpc:async(name,args)=>{calls.push({name,args});return {data:name==='aca_claim_support_investigations'?claims:true}}},
    check:async role=>{checks.push(role);return good(role)},
    pause:async ms=>{pauses.push(ms);time+=ms},now:()=>new Date(time),
  }}
}
test('an idle or disabled queue performs no probes, model calls, mail or repair',async()=>{
  const f=fixture([]);assert.deepEqual(await investigateSupport(f.options),{claimed:0,recorded:0,pending:0})
  assert.deepEqual(f.checks,[]);assert.deepEqual(f.pauses,[])
})
test('two independent check rounds are shared by the bounded batch and never resolve the case',async()=>{
  const f=fixture([claim,{...claim,case_id:'00000000-0000-4000-8000-000000000003'}])
  assert.deepEqual(await investigateSupport(f.options),{claimed:2,recorded:2,pending:0})
  assert.deepEqual(f.checks,['website','backend','website','backend']);assert.deepEqual(f.pauses,[16000])
  const report=f.calls[1].args.p_report
  assert.equal(report.diagnosis,'no_shared_outage');assert.equal(report.repair_performed,false);assert.equal(report.user_flow_verified,false)
  assert.equal(Date.parse(report.observed_at)-Date.parse(report.started_at),16000)
  assert.deepEqual(f.calls.map(c=>c.name),['aca_claim_support_investigations','aca_complete_support_investigation','aca_complete_support_investigation'])
})
test('failed backend readiness is recorded without accepting provider payloads or requester commands',async()=>{
  const f=fixture();f.options.check=async role=>role==='website'?good(role):{code:503,ready:false,readiness:'unavailable',error:null,body:'secret',command:'unlock accounts'}
  await investigateSupport(f.options);const report=f.calls[1].args.p_report
  assert.equal(report.diagnosis,'backend_readiness_failed');assert.doesNotMatch(JSON.stringify(report),/secret|unlock|body|command/)
})
test('outage and intermittent observations do not claim root cause or recovery',async()=>{
  for(const [expected,fn] of [
    ['both_unavailable',()=>({code:null,ready:false,readiness:null,error:'request_failed'})],
    ['website_unavailable',r=>r==='website'?{code:503,ready:false,readiness:null,error:null}:good(r)],
    ['backend_unavailable',r=>r==='backend'?{code:502,ready:false,readiness:null,error:null}:good(r)],
  ]){const f=fixture();f.options.check=async r=>fn(r);await investigateSupport(f.options);assert.equal(f.calls[1].args.p_report.diagnosis,expected)}
  const f=fixture();let round=0;f.options.check=async r=>{round++;return round===3?{code:503,ready:false,readiness:null,error:null}:good(r)}
  await investigateSupport(f.options);assert.equal(f.calls[1].args.p_report.diagnosis,'intermittent')
})
test('expired or superseded claim completion stays pending; database failure is not success',async()=>{
  const f=fixture();f.options.db.rpc=async name=>({data:name==='aca_claim_support_investigations'?[claim]:false})
  assert.deepEqual(await investigateSupport(f.options),{claimed:1,recorded:0,pending:1})
  f.options.db.rpc=async()=>({error:{message:'private provider text'}})
  await assert.rejects(()=>investigateSupport(f.options),/^Error: Support investigation database operation failed$/)
})
test('invalid claims and untrusted sample values stop before evidence is written',async()=>{
  for(const claims of [[{...claim,category:'payment'}],Array(6).fill(claim),[{...claim,claim_token:'arbitrary'}],null]){
    const f=fixture(claims);await assert.rejects(()=>investigateSupport(f.options));assert.equal(f.checks.length,0)
  }
  const f=fixture();f.options.check=async()=>({code:500,ready:true,readiness:null,error:null})
  await assert.rejects(()=>investigateSupport(f.options));assert.equal(f.calls.length,1)
})
