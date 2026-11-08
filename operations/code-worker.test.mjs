import test from 'node:test'
import assert from 'node:assert/strict'
import {workerContext,dockerArguments,runCodeWorker} from './code-worker.mjs'
const sha='a'.repeat(40),job={job_id:'00000000-0000-4000-8000-000000000001',claim_token:'00000000-0000-4000-8000-000000000002',base_sha:sha}
const env={GITHUB_REPOSITORY:'teeleebiz-web/aiconfidenceacademy-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_run',GITHUB_RUN_ID:'123',GITHUB_SHA:sha,ACA_PARENT_BRANCH:'main',ACA_PARENT_RESULT:'success',ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY:'fixture-private',GITHUB_TOKEN:'fixture-repo'}
test('only trusted main diagnostic completions can execute coding work',()=>{
 assert.equal(workerContext(env),sha)
 for(const patch of [{GITHUB_REF:'refs/heads/evil'},{ACA_PARENT_BRANCH:'evil'},{ACA_PARENT_RESULT:'failure'},{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_SHA:'x'}])assert.throws(()=>workerContext({...env,...patch}))
})
test('sandbox has no network, credentials, docker socket or privileges',()=>{
 const args=dockerArguments({workspace:'/tmp/safe',dependencies:'/tmp/deps',name:'aca-code-fixture',script:'npm test',uid:1001,gid:1001})
 for(const [flag,value] of [['--network','none'],['--cap-drop','ALL'],['--security-opt','no-new-privileges'],['--user','1001:1001']])assert.equal(args[args.indexOf(flag)+1],value)
 assert.ok(args.includes('--read-only'));assert.ok(args.some(x=>x.includes('node_modules,readonly')))
 assert.ok(!args.join(' ').match(/GITHUB_TOKEN|SERVICE_ROLE|OPENAI_API_KEY|docker.sock|--privileged/))
})
test('idle worker never calls model, sandbox or publisher',async()=>{
 const result=await runCodeWorker({env,db:{rpc:async()=>({data:[]})},fetcher:()=>{throw Error('not expected')}})
 assert.deepEqual(result,{idle:true})
})
test('failed reproduction cannot publish; successful isolated checks produce draft metadata only',async()=>{
 for(const tests of [{before:false,after:false},{before:true,after:false},{before:true,after:true}]){
  const events=[]
  const db={rpc:async(name,args)=>{events.push({name,args});return {data:name==='aca_claim_support_code_job'?[job]:true}}}
  const result=await runCodeWorker({env,db,fetcher:async()=>new Response(JSON.stringify({proposal:{outcome:'candidate'}})),runTests:async()=>tests,publish:async()=>{events.push({name:'publish'});return {branch:'aca-agent/'+job.job_id,pr:12}}})
  assert.equal(events.some(e=>e.name==='publish'),tests.before&&tests.after)
  assert.equal(result.status,tests.before&&tests.after?'draft_ready':'test_failed')
  assert.ok(!events.some(e=>/resolve|repair|deploy/.test(e.name)))
 }
})
test('policy or generation change after tests prevents repository writes',async()=>{
 const db={rpc:async name=>({data:name==='aca_claim_support_code_job'?[job]:name==='aca_code_publication_allowed'?false:true})}
 let published=false
 await assert.rejects(()=>runCodeWorker({env,db,fetcher:async()=>new Response(JSON.stringify({proposal:{outcome:'candidate'}})),runTests:async()=>({before:true,after:true}),publish:async()=>{published=true}}))
 assert.equal(published,false)
})
