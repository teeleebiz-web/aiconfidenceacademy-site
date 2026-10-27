import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { createAvailabilityHandler, externalAvailability } from './availability.mjs'
import { createAcademyServer } from '../server.mjs'

const response = () => ({ headers:{}, setHeader(k,v){this.headers[k]=v},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers)},end(body){this.body=body} })
function database(read) {
  let calls=0
  return {get calls(){return calls},from(table){calls++;assert.equal(table,'aca_operational_monitor');return {
    select(fields){assert.equal(fields,'id');return this},eq(k,v){assert.equal(k,'id');assert.equal(v,true);return this},
    abortSignal(signal){assert.ok(signal instanceof AbortSignal);return this},maybeSingle:read,
  }}}
}
test('readiness reveals only a generic result and uses one fixed read without accepting query instructions',async()=>{
 const db=database(async()=>({data:{id:true}})),handler=createAvailabilityHandler({db}),res=response()
 await handler({method:'GET',url:'/api/health?force_down=true&table=learners'},res)
 assert.equal(res.status,200);assert.deepEqual(JSON.parse(res.body),{service:'aca-backend',status:'ok'})
 assert.equal(db.calls,1);assert.equal(res.headers['Cache-Control'],'no-store');assert.match(res.headers['X-Robots-Tag'],/noindex/)
})
test('database errors, missing singleton, missing configuration and timeouts return the same safe failure',async()=>{
 for(const db of [undefined,database(async()=>({error:Error('private provider detail and credential')})),database(async()=>({data:null})),database(async()=>({data:{id:false}})),database(()=>new Promise(()=>{}))]){
  const res=response();await createAvailabilityHandler({db,timeoutMs:10})({method:'GET'},res)
  assert.equal(res.status,503);assert.equal(res.body,'{"service":"aca-backend","status":"unavailable"}')
 }
})
test('HEAD preserves readiness status without a body and write methods cannot reach the database',async()=>{
 const db=database(async()=>({data:{id:true}})),handler=createAvailabilityHandler({db})
 for(const method of ['POST','PATCH','PUT','DELETE','OPTIONS']){const res=response();await handler({method},res);assert.equal(res.status,405)}
 assert.equal(db.calls,0);const head=response();await handler({method:'HEAD'},head);assert.equal(head.status,200);assert.equal(head.body,undefined)
})
test('concurrent probes coalesce and the bounded cache expires for outage and recovery detection',async()=>{
 let now=1000,up=true,finish
 const db=database(()=>new Promise(r=>{finish=()=>r(up?{data:{id:true}}:{error:Error('offline')})})),handler=createAvailabilityHandler({db,now:()=>now,cacheMs:15})
 const responses=[response(),response(),response()];const requests=responses.map(res=>handler({method:'GET'},res));await Promise.resolve();await Promise.resolve();finish();await Promise.all(requests)
 assert.equal(db.calls,1);assert.ok(responses.every(r=>r.status===200))
 const cached=response();await handler({method:'GET'},cached);assert.equal(db.calls,1)
 now+=16;up=false;const down=response(),p=handler({method:'GET'},down);await Promise.resolve();finish();await p;assert.equal(down.status,503)
 now+=16;up=true;const recovered=response(),p2=handler({method:'GET'},recovered);await Promise.resolve();finish();await p2;assert.equal(recovered.status,200)
})
test('the production server exposes only the health path while owner and curriculum authentication stay required',async()=>{
 const db=database(async()=>({data:{id:true}})),server=createAcademyServer({password:'test-only-long-construction-password',root:tmpdir(),courseId:'test-course',db})
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`
 try{
  assert.equal((await fetch(base+'/api/health')).status,200)
  assert.equal((await fetch(base+'/api/health/records')).status,401)
  assert.equal((await fetch(base+'/api/operations/control-center')).status,401)
  assert.equal((await fetch(base+'/api/academy/phase-one')).status,401)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})
test('unverified or unsafe provider configuration cannot claim monitoring is connected',()=>{
 const good={dashboard_url:'https://app.statuscake.com/',website_monitor_id:'123',backend_monitor_id:'456',verified_at:'2026-10-27T10:00:00Z',interval_seconds:300}
 assert.equal(externalAvailability(JSON.stringify(good)).configured,true)
 for(const value of [undefined,'bad',{}, {...good,website_monitor_id:'123&token=private'},{...good,backend_monitor_id:'123'},{...good,dashboard_url:'https://user:password@app.statuscake.com/'},{...good,dashboard_url:'https://app.statuscake.com/?token=private'},{...good,dashboard_url:'https://attacker.test/'},{...good,interval_seconds:0}]){
  const result=externalAvailability(value);assert.equal(result.configured,false);assert.equal(result.dashboard_url,null)
 }
 assert.doesNotMatch(JSON.stringify(externalAvailability(good)),/123|456/,'Monitor identifiers remain server-side')
})
