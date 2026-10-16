import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'

async function endpoint(status='active') {
 let handler;const writes=[]
 const source=stripTypeScriptTypes(await readFile(new URL('../../supabase/functions/aca-interest-list/index.ts',import.meta.url),'utf8'))
 runInNewContext(source,{Request,Response,console,Deno:{serve(fn){handler=fn},env:{get(k){return {SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test'}[k]}}},fetch:async(url,options)=>{
   const value=JSON.parse(options.body);writes.push({url,value})
   return new Response(JSON.stringify([{...value,id:1,status,unsubscribe_token:'test-token'}]),{status:200})
 }})
 return {writes,send:payload=>handler(new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({firstName:'Test',lastName:'User',email:'TEST@example.org',consent:true,...payload})}))}
}
test('signup accepts multiple interests and saves only the explicit selection',async()=>{
 const api=await endpoint();const response=await api.send({interests:['Videos','Books & Resources']})
 assert.equal(response.status,200);assert.equal(api.writes.length,2)
 assert.deepEqual(api.writes[1].value.interests,['Videos','Books & Resources'])
 assert.equal(api.writes[1].value.routing_synced,false)
 assert.equal(api.writes[1].value.status,undefined,'must not restore a previous opt-out')
})
test('legacy single-interest clients remain compatible',async()=>{
 const api=await endpoint();assert.equal((await api.send({interest:'Phase One'})).status,200)
 assert.deepEqual(api.writes[1].value.interests,['Phase One'])
})
test('empty, invalid or missing consent requests do not write subscription records',async()=>{
 for(const payload of [{interests:[]},{interests:['Videos','Unknown']},{interests:['Videos'],consent:false}]) {
  const api=await endpoint();assert.equal((await api.send(payload)).status,422);assert.equal(api.writes.length,0)
 }
})
test('an existing unsubscribe does not become an active optional subscriber on repeat signup',async()=>{
 const api=await endpoint('unsubscribed');assert.equal((await api.send({interests:['Videos']})).status,200)
 assert.equal(api.writes.length,1)
})
