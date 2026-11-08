import test from 'node:test'
import assert from 'node:assert/strict'
import {workerContext,dockerArguments,runCodeWorker,publishCandidate,checkCodeReadiness} from './code-worker.mjs'
const sha='a'.repeat(40),job={job_id:'00000000-0000-4000-8000-000000000001',claim_token:'00000000-0000-4000-8000-000000000002',base_sha:sha}
const env={GITHUB_REPOSITORY:'teeleebiz-web/aiconfidenceacademy-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_run',GITHUB_RUN_ID:'123',GITHUB_SHA:sha,ACA_PARENT_BRANCH:'main',ACA_PARENT_RESULT:'success',ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY:'fixture-private',GITHUB_TOKEN:'fixture-repo'}
test('only trusted main diagnostic completions can execute coding work, even after a provider failure',()=>{
 assert.equal(workerContext(env),sha)
 assert.equal(workerContext({...env,ACA_PARENT_RESULT:'failure'}),sha) // Durable database evidence, not provider availability, controls eligibility.
 for(const patch of [{GITHUB_REF:'refs/heads/evil'},{ACA_PARENT_BRANCH:'evil'},{ACA_PARENT_RESULT:'cancelled'},{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_SHA:'x'}])assert.throws(()=>workerContext({...env,...patch}))
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

test('publisher blocks automatic preview deployment and writes only a draft',async()=>{
 const {mkdtemp,readFile,writeFile,mkdir,rm}=await import('node:fs/promises')
 const {tmpdir}=await import('node:os'),{join,dirname}=await import('node:path')
 const root=await mkdtemp(join(tmpdir(),'aca-publish-'))
 try{
  for(const path of ['portal/src/lib/usePageStart.ts','portal/src/components/AcademyShell.tsx']){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),await readFile(path,'utf8'))}
  const proposal={kind:'navigation',outcome:'candidate',edits:[{path:'portal/src/lib/usePageStart.ts',before:'top: 0, left: 0',after:'top: 0, left: 1 /* $& literal */'}],test:{path:'portal/src/agent-regression.test.tsx',content:'// Synthetic publisher fixture, never executed or published.'}}
  const calls=[],github=async(path,method='GET',body)=>{calls.push({path,method,body});if(path==='/git/ref/heads/main')return {object:{sha}};if(path==='/git/commits/'+sha)return {tree:{sha}};if(path==='/pulls')return {number:123};return {sha}}
  await writeFile(join(root,'vercel.json'),'{}')
  await assert.rejects(()=>publishCandidate({root,job,proposal,github}),/deployment is not blocked/)
  assert.equal(calls.length,0)
  await writeFile(join(root,'vercel.json'),JSON.stringify({git:{deploymentEnabled:{'aca-agent/**':false}}}))
  assert.deepEqual(await publishCandidate({root,job,proposal,github}),{branch:'aca-agent/'+job.job_id,pr:123})
  assert.equal(calls.find(c=>c.path==='/pulls').body.draft,true)
  assert.ok(calls.find(c=>c.path==='/git/trees').body.tree[0].content.includes('/* $& literal */'))
  assert.deepEqual(calls.filter(c=>c.method==='POST').map(c=>c.path),['/git/trees','/git/commits','/git/refs','/pulls','/actions/workflows/portal-ci.yml/dispatches'])
  const firstTree=calls.find(c=>c.path==='/git/trees').body.tree
  assert.equal(firstTree.length,2)
  const firstTest=firstTree[1]
  assert.match(firstTest.path,/^portal\/src\/agent-regression-[a-f0-9]{64}\.test\.tsx$/)
  assert.equal(firstTest.content,proposal.test.content)
  // Simulate two earlier saved tests, including an exact generated-name
  // collision. A later draft must retain both and publish a new test instead.
  const prior='// Prior regression must remain byte-for-byte intact.'
  await writeFile(join(root,proposal.test.path),prior)
  await writeFile(join(root,firstTest.path),prior)
  calls.length=0
  await publishCandidate({root,job,proposal,github})
  const nextTest=calls.find(c=>c.path==='/git/trees').body.tree[1]
  assert.equal(nextTest.path,firstTest.path.replace('.test.tsx','-1.test.tsx'))
  assert.equal(nextTest.content,proposal.test.content)
  for(const path of [proposal.test.path,firstTest.path])assert.equal(await readFile(join(root,path),'utf8'),prior)
  // A repeated collision is handled too; no occupied path is ever selected.
  await writeFile(join(root,nextTest.path),prior)
  calls.length=0
  await publishCandidate({root,job,proposal,github})
  assert.equal(calls.find(c=>c.path==='/git/trees').body.tree[1].path,firstTest.path.replace('.test.tsx','-2.test.tsx'))
  // Bounded exhaustion stops before any repository mutation.
  for(let i=2;i<100;i++)await writeFile(join(root,firstTest.path.replace('.test.tsx',`-${i}.test.tsx`)),prior)
  calls.length=0
  await assert.rejects(()=>publishCandidate({root,job,proposal,github}),/No unused regression path/)
  assert.ok(calls.every(c=>c.method==='GET'))
 }finally{await rm(root,{recursive:true,force:true})}
})

test('live readiness authenticates without a case or paid model request',async()=>{
 const requests=[]
 const result=await checkCodeReadiness(env,async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({ready:true,enabled:false}))})
 assert.deepEqual(result,{ready:true,enabled:false})
 assert.equal(requests.length,1);assert.equal(requests[0].options.method,'GET');assert.equal(requests[0].options.body,undefined)
 for(const response of [new Response('{}',{status:401}),new Response('{"ready":false,"enabled":false}')])await assert.rejects(()=>checkCodeReadiness(env,async()=>response))
})
