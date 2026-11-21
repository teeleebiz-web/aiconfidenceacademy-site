import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { permittedRepairFiles, permittedOutput, releaseContext } from './support-release.mjs'
import { servedRevision, rollbackRelease, reconcileReleases } from './support-release-reconcile.mjs'
const sha='a'.repeat(40), next='b'.repeat(40), id='11111111-1111-4111-8111-111111111111'
const regression={filename:`portal/src/agent-regression-${'c'.repeat(64)}.test.tsx`,status:'added'}
test('only a single existing repair category and one new regression can be released',()=>{
 assert.equal(permittedRepairFiles([{filename:'portal/src/components/SignIn.tsx',status:'modified'},regression]),true)
 for(const source of ['package.json','.github/workflows/portal-ci.yml','academy/enrollment/payment.mjs','portal/src/components/SupportInbox.tsx']) {
  assert.equal(permittedRepairFiles([{filename:'portal/src/components/SignIn.tsx',status:'modified'},{filename:source,status:'modified'},regression]),false)
 }
 assert.equal(permittedRepairFiles([{filename:'portal/src/components/SignIn.tsx',status:'removed'},regression]),false)
 assert.equal(permittedRepairFiles([regression]),false)
 assert.equal(permittedOutput('learn/assets/../../api/site.mjs'),false)
 assert.equal(permittedOutput('learn/assets/main-AbCd1234.js'),true)
})
function fixture({main=sha,generation=1,enabled=true,caseStatus='open'}={}) {
 const tables={aca_support_code_settings:{enabled:true,auto_release_enabled:enabled},aca_support_code_jobs:{status:'draft_ready',regression_failed_before:true,checks_passed_after:true,reserved_cents:25,case_id:id,generation:1,base_sha:sha},aca_support_cases:{status:caseStatus},aca_support_investigations:{generation}}
 const db={from(table){return {select(){return this},eq(){return this},single:async()=>({data:tables[table]})}}}
 const github=async path=>path.startsWith('/actions/runs/7/jobs')?{jobs:['verify','retry-database','code-isolation'].map(name=>({name,conclusion:'success'}))}:path==='/actions/runs/7'?{name:'ACA learner portal checks',conclusion:'success',event:'workflow_dispatch',repository:{full_name:'teeleebiz-web/aiconfidenceacademy-site'},head_branch:`aca-agent/${id}`,head_sha:next}:path==='/git/ref/heads/main'?{object:{sha:main}}:path.startsWith('/git/ref/heads/aca-agent/')?{object:{sha:next}}:{status:'ahead',files:[{filename:'portal/src/components/SignIn.tsx',status:'modified'},regression]}
 return {db,github,runId:'7'}
}
test('a changed main, new requester message, closed case or disabled authority prevents release',async()=>{
 assert.ok(await releaseContext(...Object.values(fixture())))
 for(const input of [{main:next},{generation:2},{enabled:false},{caseStatus:'resolved'}])assert.equal(await releaseContext(...Object.values(fixture(input))),null)
})
test('served revision requires exact compiled content and healthy backend',async()=>{
 const content='approved compiled bytes', hash=createHash('sha256').update(content).digest('hex')
 const output=['learn/index.html','control-center/index.html','learn/assets/main-AbCd.js'].map(path=>({path,sha256:hash}))
 const good=async url=>url.includes('/api/health')?Response.json({service:'aca-backend',status:'ok'}):new Response(content)
 assert.equal(await servedRevision(output,good),true)
 assert.equal(await servedRevision(output,async()=>new Response('old version')),false)
 assert.equal(await servedRevision([{path:'api/site.mjs',sha256:hash},...output],good),false)
 assert.equal(await servedRevision(output,async url=>url.includes('/api/health')?Response.json({status:'down'}):new Response(content)),false)
})
test('automatic rollback preserves newer work and never force-pushes',async()=>{
 const calls=[]
 assert.equal(await rollbackRelease({releaseSha:next,baseSha:sha,github:async()=>({object:{sha}})}),false)
 const github=async(path,method,body)=>{calls.push({path,method,body});return path==='/git/ref/heads/main'?{object:{sha:next}}:path.startsWith('/git/commits/')?{tree:{sha}}:path==='/git/commits'?{sha:'d'.repeat(40)}:{}}
 assert.equal(await rollbackRelease({releaseSha:next,baseSha:sha,github}),true)
 assert.deepEqual(calls.find(c=>c.method==='PATCH').body,{sha:'d'.repeat(40),force:false})
 assert.deepEqual(calls.find(c=>c.path==='/git/commits').body.parents,[next])
})

test('Vercel-hosted releases require exact served bytes but never depend on disabled Pages', async()=>{
 const content='approved compiled bytes', hash=createHash('sha256').update(content).digest('hex')
 const output=['learn/index.html','control-center/index.html','learn/assets/main-AbCd.js'].map(path=>({path,sha256:hash}))
 const release={release_sha:next,job_id:id,verification:{output},created_at:new Date().toISOString()}
 for(const matches of [true,false]){
  const updates=[],calls=[]
  const db={from(table){const q={select(){return q},in(){return q},not(){return q},order(){return q},limit:async()=>({data:[release]}),eq(){return q},single:async()=>({data:{base_sha:sha}}),update(value){updates.push(value);return q},then(resolve){return Promise.resolve({data:{}}).then(resolve)}};return q}}
  const github=async path=>{calls.push(path);if(path.includes('/pages/'))throw Error('Pages must stay disabled');return{statuses:[{context:'Vercel',target_url:'https://vercel.com/aiconfidenceacademy-site-mkvf/release',state:'success'}]}}
  const fetcher=async url=>url.includes('/api/health')?Response.json({service:'aca-backend',status:'ok'}):new Response(matches?content:'wrong revision')
  await reconcileReleases({db,github,fetcher,publicSite:true})
  assert.equal(updates.some(row=>row.status==='verified'),matches)
  assert.ok(!calls.some(path=>path.includes('/pages/')))
 }
})
test('Vercel rollback keeps Pages disabled and still preserves concurrent main changes',async()=>{
 const calls=[]
 const github=async(path,method,body)=>{calls.push({path,method,body});return path==='/git/ref/heads/main'?{object:{sha:next}}:path.startsWith('/git/commits/')?{tree:{sha}}:path==='/git/commits'?{sha:'d'.repeat(40)}:{}}
 assert.equal(await rollbackRelease({releaseSha:next,baseSha:sha,github,publicSite:true}),true)
 assert.ok(!calls.some(c=>c.path.includes('/pages/')))
 assert.equal(calls.find(c=>c.method==='PATCH').body.force,false)
})
