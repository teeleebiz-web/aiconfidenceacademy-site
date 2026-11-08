// Credential-free acceptance test. The synthetic defect exists only in a local
// detached worktree; it is never published and never touches a support case.
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {command,testCandidate} from './code-worker.mjs'
const root=process.cwd(),dir=await mkdtemp(join(tmpdir(),'aca-isolation-')),fixture=join(dir,'source')
const run=async(file,args,cwd=root)=>{const r=await command(file,args,{cwd,timeout:300000});if(r.code!==0)throw Error(`${file} fixture operation failed: ${r.output}`);return r}
try{
 await run('git',['worktree','add','--detach',fixture,'HEAD'])
 const path='portal/src/lib/usePageStart.ts',original=await readFile(join(fixture,path),'utf8')
 assert.ok(original.includes('top: 0, left: 0'))
 await writeFile(join(fixture,path),original.replace('top: 0, left: 0','top: 123, left: 0'))
 // Docker bind sources must be real paths; use the already installed, trusted
 // dependency directory through an explicit symlink resolved by the harness.
 const {symlink}=await import('node:fs/promises')
 await symlink(resolve(root,'node_modules'),join(fixture,'node_modules'),'dir')
 const proposal={kind:'navigation',outcome:'candidate',edits:[{path,before:'top: 123, left: 0',after:'top: 0, left: 0'}],test:{path:'portal/src/agent-regression.test.tsx',content:`
import {render,cleanup} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
// @ts-expect-error Node built-in used only in this container-boundary fixture.
import {writeFileSync,existsSync} from 'node:fs'
declare const process:{env:Record<string,string|undefined>}
import {usePageStart} from './lib/usePageStart'
afterEach(cleanup)
function Page(){usePageStart('fixture');return <main><h1>Fixture</h1></main>}
it('resets a newly selected destination to its beginning',()=>{const scroll=vi.spyOn(window,'scrollTo');render(<Page/>);expect(scroll).toHaveBeenCalledWith({top:0,left:0,behavior:'instant'})})
it('cannot access host credentials or mutate trusted sources',()=>{
 expect(process.env.ACA_ISOLATION_SENTINEL).toBeUndefined()
 expect(process.env.GITHUB_TOKEN).toBeUndefined()
 expect(process.env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY).toBeUndefined()
 expect(existsSync('/var/run/docker.sock')).toBe(false)
 expect(existsSync('/workspace/.git')).toBe(false)
 expect(()=>writeFileSync('/workspace/package.json','{}')).toThrow()
})
it('cannot reach the network',async()=>{await expect(fetch('https://example.com',{signal:AbortSignal.timeout(1000)})).rejects.toThrow()})
`}}
 // Retain the legacy filename and deliberately occupy this proposal's first
 // generated filename. Neither earlier test may be overwritten or removed.
 const digest=createHash('sha256').update(JSON.stringify({edits:proposal.edits,test:proposal.test.content})).digest('hex')
 const priorPaths=[proposal.test.path,`portal/src/agent-regression-${digest}.test.tsx`]
 const priorContent=new Map()
 for(const priorPath of priorPaths){
  try{await writeFile(join(fixture,priorPath),"import {it,expect} from 'vitest'\nit('preserves earlier regression coverage',()=>expect(true).toBe(true))\n",{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}
  priorContent.set(priorPath,await readFile(join(fixture,priorPath),'utf8'))
 }
 await run('git',['add',path,...priorPaths],fixture)
 await run('git',['-c','user.name=ACA isolation fixture','-c','user.email=fixture@example.invalid','commit','-m','Local synthetic navigation defect with earlier regressions'],fixture)
 process.env.ACA_ISOLATION_SENTINEL='must-not-enter-container'
 let containerRuns=0
 const result=await testCandidate({root:fixture,proposal,run:async(...args)=>{
  const r=await command(...args)
  if(args[0]==='docker'&&args[1][0]==='run'){
   containerRuns++
   const sourceMount=args[1].find(a=>a.startsWith('type=bind,src=')&&a.endsWith('dst=/workspace,readonly'))
   const snapshot=sourceMount.slice('type=bind,src='.length,-',dst=/workspace,readonly'.length)
   for(const [p,content] of priorContent)assert.equal(await readFile(join(snapshot,p),'utf8'),content)
   assert.equal(await readFile(join(snapshot,`portal/src/agent-regression-${digest}-1.test.tsx`),'utf8'),proposal.test.content)
   if(containerRuns===1)assert.ok(args[1].at(-1).includes(`agent-regression-${digest}-1.test.tsx --reporter=json`))
   if(r.code!==0)console.log(JSON.stringify({exit:r.code,timedOut:r.timedOut})+'\n'+r.output)
  }
  return r
 }})
 assert.deepEqual(result,{before:true,after:true})
 assert.equal(containerRuns,2)
 console.log('Verified: earlier regressions preserved, filename collision avoided, baseline regression, repaired checks, read-only sources, no credentials and no network.')
}finally{delete process.env.ACA_ISOLATION_SENTINEL;await command('git',['worktree','remove','--force',fixture],{cwd:root});await rm(dir,{recursive:true,force:true})}
