import {createClient} from '@supabase/supabase-js'
import {mkdtemp,readFile,writeFile,rm,lstat,mkdir,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import {codeSources,validateProposal,validId,validSha} from '../academy/support/code-policy.mjs'
import {projectRef} from './recovery.mjs'

const repository='teeleebiz-web/aiconfidenceacademy-site'
const checked=r=>{if(r?.error)throw Error('Coding ledger unavailable');return r.data}
export function workerContext(env){
 if(env.GITHUB_REPOSITORY!==repository||env.GITHUB_REF!=='refs/heads/main'||!['workflow_run','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)||!/^\d+$/.test(env.GITHUB_RUN_ID||'')||!validSha(env.GITHUB_SHA))throw Error('Untrusted coding runner')
 if(env.GITHUB_EVENT_NAME==='workflow_run'&&(env.ACA_PARENT_BRANCH!=='main'||!['success','failure'].includes(env.ACA_PARENT_RESULT)))throw Error('Untrusted diagnostic result')
 return env.GITHUB_SHA
}
// All commands are fixed by trusted source. Model text is never a shell command.
export async function command(file,args,{cwd,timeout=180000,env=process.env}={}){
 return new Promise((resolveResult,reject)=>{
  const child=spawn(file,args,{cwd,env,stdio:['ignore','pipe','pipe']}),chunks=[];let bytes=0,timedOut=false
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},timeout)
  const receive=b=>{chunks.push(b);bytes+=b.length;while(bytes>32768&&chunks.length){const excess=bytes-32768,first=chunks[0];if(first.length<=excess){bytes-=chunks.shift().length}else{chunks[0]=first.subarray(excess);bytes-=excess}}}
  child.stdout.on('data',receive);child.stderr.on('data',receive)
  child.on('error',e=>{clearTimeout(timer);reject(e)})
  child.on('close',code=>{clearTimeout(timer);resolveResult({code,timedOut,output:Buffer.concat(chunks).toString('utf8')})})
 })
}
async function sourcesFrom(root,kind){
 const sources={}
 for(const path of codeSources[kind]||[]){
  const full=resolve(root,path);if(!(await lstat(full)).isFile())throw Error('Invalid source type')
  sources[path]=await readFile(full,'utf8')
 }
 return sources
}
export function dockerArguments({workspace,dependencies,name,script,uid,gid}){
 if(!/^aca-code-[a-z0-9-]+$/.test(name))throw Error('Invalid container name')
 return ['run','--rm','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','256','--memory','1536m','--cpus','2','--user',`${uid}:${gid}`,'--tmpfs','/tmp:rw,nosuid,nodev,size=256m','--mount',`type=bind,src=${workspace},dst=/workspace,readonly`,'--mount',`type=bind,src=${dependencies},dst=/workspace/node_modules,readonly`,'--workdir','/workspace','--env','HOME=/tmp','--env','CI=true','--env','VITE_SUPABASE_URL=https://example.invalid','--env','VITE_SUPABASE_ANON_KEY=fixture-only','node:24-bookworm','sh','-c',script]
}
export async function testCandidate({root,proposal,run=command}){
 const sources=await sourcesFrom(root,proposal.kind)
 const clean={outcome:proposal.outcome,edits:proposal.edits,test:proposal.test}
 validateProposal(clean,sources,proposal.kind)
 if(clean.outcome!=='candidate')return {before:false,after:false}
 const directory=await mkdtemp(join(tmpdir(),'aca-code-')),workspace=join(directory,'workspace'),archive=join(directory,'source.tar')
 const name='aca-code-'+directory.split('/').at(-1).toLowerCase()
 let before=false,after=false
 try{
  await mkdir(workspace)
  if((await run('git',['archive','--format=tar','-o',archive,'HEAD'],{cwd:root})).code!==0)throw Error('Source snapshot failed')
  if((await run('tar',['-xf',archive,'-C',workspace],{cwd:root})).code!==0)throw Error('Source extraction failed')
  await mkdir(join(workspace,'node_modules'),{recursive:true}) // Mountpoint must exist before the read-only source bind.
  try{await lstat(join(workspace,proposal.test.path));throw Error('Regression path already exists')}catch(e){if(e.code!=='ENOENT')throw e}
  await writeFile(join(workspace,proposal.test.path),proposal.test.content,{flag:'wx'})
  const invoke=async script=>{
   try{return await run('docker',dockerArguments({workspace,dependencies:await realpath(resolve(root,'node_modules')),name,script,uid:process.getuid(),gid:process.getgid()}),{cwd:root,timeout:240000})}
   finally{await run('docker',['rm','-f',name],{cwd:root,timeout:10000}).catch(()=>{})}
  }
  const regression='node node_modules/vitest/vitest.mjs run --config portal/vitest.config.ts --configLoader runner --no-cache --maxWorkers 2 portal/src/agent-regression.test.tsx --reporter=json --outputFile=/tmp/result.json; result=$?; cat /tmp/result.json; exit "$result"'
  const original=await invoke(regression)
  // A process crash, timeout or transform/import error is not a reproduction.
  const jsonStart=original.output.indexOf('{"numTotalTestSuites"')
  let report;try{report=JSON.parse(original.output.slice(jsonStart))}catch{}
  before=!original.timedOut&&original.code===1&&report?.numFailedTests>0&&report?.numTotalTests>0
  if(!before)return {before:false,after:false}
  for(const edit of clean.edits)await writeFile(join(workspace,edit.path),sources[edit.path].replace(edit.before,()=>edit.after))
  const repaired=await invoke('npm run typecheck && node node_modules/vitest/vitest.mjs run --config portal/vitest.config.ts --configLoader runner --no-cache --maxWorkers 2 && npm run test:academy -- --test-concurrency=1 && npm run test:recovery -- --test-concurrency=1')
  after=!repaired.timedOut&&repaired.code===0
  return {before,after}
 }finally{await rm(directory,{recursive:true,force:true})}
}
export async function publishCandidate({root,job,proposal,github}){
 const deployment=JSON.parse(await readFile(join(root,'vercel.json'),'utf8')).git?.deploymentEnabled
 if(!deployment||Object.keys(deployment).length!==1||deployment['aca-agent/**']!==false)throw Error('Automated branch deployment is not blocked')
 const current=await github('/git/ref/heads/main')
 if(current.object?.sha!==job.base_sha)throw Error('Source changed; candidate requires new investigation')
 const sources=await sourcesFrom(root,proposal.kind)
 validateProposal({outcome:proposal.outcome,edits:proposal.edits,test:proposal.test},sources,proposal.kind)
 const base=await github('/git/commits/'+job.base_sha)
 const tree=await github('/git/trees','POST',{base_tree:base.tree.sha,tree:[...proposal.edits.map(e=>({path:e.path,mode:'100644',type:'blob',content:sources[e.path].replace(e.before,()=>e.after)})),{path:proposal.test.path,mode:'100644',type:'blob',content:proposal.test.content}]})
 const commit=await github('/git/commits','POST',{message:'Prepare isolated technical repair candidate',tree:tree.sha,parents:[job.base_sha]})
 const branch='aca-agent/'+job.job_id
 await github('/git/refs','POST',{ref:'refs/heads/'+branch,sha:commit.sha})
 let pr=null
 try{const value=await github('/pulls','POST',{title:'ACA automated technical repair candidate',head:branch,base:'main',draft:true,body:'Prepared by the authorized incident coding worker. A new regression failed on the unchanged base and passed after the candidate; the isolated application checks passed. Production recovery is not established. Review the exact diff and CI before authorizing any release. No private support content is included in this description.'});pr=value.number}catch(e){if(![403,422].includes(e.status))throw e}
 // Dispatching an explicitly credential-free workflow avoids relying on push
 // events generated by GITHUB_TOKEN to trigger GitHub's recursive workflows.
 await github('/actions/workflows/portal-ci.yml/dispatches','POST',{ref:branch}).catch(()=>{}) // Draft remains reviewable if CI dispatch is unavailable.
 return {branch,pr}
}
export async function runCodeWorker({env=process.env,root=process.cwd(),fetcher=fetch,db,runTests=testCandidate,publish=publishCandidate}={}){
 const sha=workerContext(env)
 if(!env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY||!env.GITHUB_TOKEN)throw Error('Coding runner credentials unavailable')
 db??=createClient(`https://${projectRef}.supabase.co`,env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetcher(url,{...options,signal:AbortSignal.timeout(10000)})}})
 const jobs=checked(await db.rpc('aca_claim_support_code_job',{p_run_id:env.GITHUB_RUN_ID,p_base_sha:sha}))
 if(!Array.isArray(jobs)||jobs.length>1)throw Error('Invalid coding claims')
 if(!jobs.length)return {idle:true}
 const job=jobs[0]
 if(!validId(job.job_id)||!validId(job.claim_token)||job.base_sha!==sha)throw Error('Invalid coding claim')
 const finish=async(status,before=false,after=false,branch=null,pr=null)=>{
  if(checked(await db.rpc('aca_finish_support_code_job',{p_job_id:job.job_id,p_token:job.claim_token,p_status:status,p_before:before,p_after:after,p_branch:branch,p_pr:pr}))!==true)throw Error('Coding completion rejected')
 }
 try{
  const response=await fetcher('https://checkout.aiconfidenceacademy.org/api/operations/code-worker',{method:'POST',redirect:'error',signal:AbortSignal.timeout(55000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY},body:JSON.stringify({jobId:job.job_id,claimToken:job.claim_token,baseSha:sha})})
  if(!response.ok)throw Error('Coding proposal request failed')
  const {boundedBody}=await import('../academy/support/code-agent.mjs')
  const {proposal}=JSON.parse(await boundedBody(response,65536))
  if(proposal?.outcome==='no_change'){validateProposal({outcome:proposal.outcome,edits:proposal.edits,test:proposal.test},{},proposal.kind);await finish('no_change');return {status:'no_change'}}
  const result=await runTests({root,proposal})
  if(!result.before||!result.after){await finish('test_failed',result.before,result.after);return {status:'test_failed'}}
  const github=async(path,method='GET',body)=>{
   const r=await fetcher(`https://api.github.com/repos/${repository}${path}`,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})})
   if(!r.ok)throw Object.assign(Error('Draft repository operation failed'),{status:r.status})
   return r.status===204?null:JSON.parse(await boundedBody(r,262144))
  }
  // Recheck activation/generation just before publication, without another paid
  // request. Closed cases or new requester messages invalidate the old task.
  const ready=checked(await db.rpc('aca_code_publication_allowed',{p_job_id:job.job_id,p_token:job.claim_token}))
  if(ready!==true)throw Error('Coding publication held')
  const output=await publish({root,job,proposal,github})
  const status=output.pr?'draft_ready':'branch_ready'
  await finish(status,true,true,output.branch,output.pr)
  return {status}
 }catch{await finish('failed').catch(()=>{});throw Error('Coding worker stopped; production was not changed')}
}
export async function checkCodeReadiness(env=process.env,fetcher=fetch){
 if(!env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY)throw Error('Coding credential unavailable')
 const response=await fetcher('https://checkout.aiconfidenceacademy.org/api/operations/code-worker',{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY}})
 if(!response.ok)throw Error('Coding readiness unavailable')
 const {boundedBody}=await import('../academy/support/code-agent.mjs')
 const result=JSON.parse(await boundedBody(response,1024))
 if(result.ready!==true||typeof result.enabled!=='boolean')throw Error('Coding configuration unavailable')
 return result
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))checkCodeReadiness().then(async readiness=>{
 console.log('Private coding connection verified; model configuration ready; policy '+(readiness.enabled?'enabled.':'disabled.'))
 return runCodeWorker()
}).then(result=>console.log(result.idle?'No new eligible coding work.':`Coding result: ${result.status}; production recovery unverified.`)).catch(()=>{console.error('Coding worker stopped safely; inspect private status.');process.exitCode=1})
