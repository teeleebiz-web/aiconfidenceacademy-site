// Trusted orchestration for one authorized, test-only real model proposal.
// The model's code executes only through the existing offline Docker boundary.
import assert from 'node:assert/strict'
import {readFile,mkdtemp,symlink,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {command,testCandidate,publishCandidate} from './code-worker.mjs'
const root=process.cwd(),repo='teeleebiz-web/aiconfidenceacademy-site'
assert.equal(process.env.GITHUB_REPOSITORY,repo)
assert.equal(process.env.GITHUB_REF,'refs/heads/aca-agent/support-real-test-20261108')
assert.equal(process.env.GITHUB_EVENT_NAME,'push')
assert.ok(process.env.GITHUB_TOKEN)
assert.equal(process.env.OPENAI_API_KEY,undefined)
assert.equal(process.env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY,undefined)
const packet=JSON.parse(await readFile('operations/support-real-candidate.json','utf8'))
const {packetHash,...input}=packet
assert.equal(createHash('sha256').update(JSON.stringify(input)).digest('hex'),packetHash)
assert.equal(packet.fixtureBranch,'aca-agent/support-fixture-20261108')
assert.equal(packet.base_sha,'efb9190ea6b464c7503cd0d8ea21d91eb2b20141')
assert.match(packet.job_id,/^[a-f0-9-]{36}$/)
const mainSha='d4e4c75d2b175035a156ce2be56f462f87d95962'
const api=async(path,method='GET',body)=>{
 const r=await fetch(`https://api.github.com/repos/${repo}${path}`,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})})
 if(!r.ok)throw Object.assign(Error('Test repository operation failed: '+r.status),{status:r.status})
 return r.status===204?null:await r.json()
}
assert.equal((await api('/git/ref/heads/main')).object.sha,mainSha)
assert.equal((await api('/git/ref/heads/'+packet.fixtureBranch)).object.sha,packet.base_sha)
const dir=await mkdtemp(join(tmpdir(),'aca-real-model-')),fixture=join(dir,'source')
const run=async(file,args,cwd=root)=>{const r=await command(file,args,{cwd,timeout:300000});assert.equal(r.code,0,r.output);return r}
try{
 await run('git',['worktree','add','--detach',fixture,packet.base_sha])
 await symlink(resolve(root,'node_modules'),join(fixture,'node_modules'),'dir')
 const result=await testCandidate({root:fixture,proposal:packet.proposal,run:async(...args)=>{
  const r=await command(...args)
  if(args[0]==='docker'&&args[1][0]==='run')console.log(JSON.stringify({stage:'candidate_container',exit:r.code,timedOut:r.timedOut})+'\n'+r.output)
  return r
 }})
 assert.deepEqual(result,{before:true,after:true},'Candidate did not prove reproduction and repair')
 // Adapt publication ONLY to the test base; never create a PR against main.
 const github=async(path,method='GET',body)=>{
  if(path==='/git/ref/heads/main'){assert.equal(method,'GET');return api('/git/ref/heads/'+packet.fixtureBranch)}
  if(path==='/git/refs')assert.equal(body.ref,'refs/heads/aca-agent/'+packet.job_id)
  if(path==='/git/commits')assert.deepEqual(body.parents,[packet.base_sha])
  if(path==='/pulls'){
   assert.equal(body.draft,true)
   body={...body,base:packet.fixtureBranch,title:'TEST ONLY AI navigation repair verification',body:'Authorized isolated test. This draft targets only the synthetic fixture branch and must never be merged into main. No real learner data, API key, payment or production repair is included.\n\n'+body.body}
  }
  assert.ok(path===`/git/commits/${packet.base_sha}`||['/git/trees','/git/commits','/git/refs','/pulls','/actions/workflows/portal-ci.yml/dispatches'].includes(path),'Unexpected publisher route')
  return api(path,method,body)
 }
 const output=await publishCandidate({root:fixture,job:{job_id:packet.job_id,base_sha:packet.base_sha},proposal:packet.proposal,github})
 assert.ok(output.pr,'Actual test draft publication was not established')
 assert.equal((await api('/git/ref/heads/main')).object.sha,mainSha)
 const proof={packetHash,...result,...output,runId:process.env.GITHUB_RUN_ID,mainUnchanged:true,baseBranch:packet.fixtureBranch}
 await writeFile('support-real-test-result.json',JSON.stringify(proof,null,2)+'\n')
 console.log('ACA_REAL_TEST_RESULT '+JSON.stringify(proof))
}finally{
 await command('git',['worktree','remove','--force',fixture],{cwd:root})
 await rm(dir,{recursive:true,force:true})
}
