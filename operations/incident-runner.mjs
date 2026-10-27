import {createClient} from '@supabase/supabase-js'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {coordinate,statusCakeReader,validatePolicy,validateMonitor,parseAlerts,probe} from './incident-diagnostics.mjs'
import {incidentConfiguration,incidentStore} from './incident-store.mjs'
import {projectRef} from './recovery.mjs'

const checked=result=>{if(result.error)throw new Error('Coordinator database operation failed');return result.data}
export async function runIncidentCoordinator({env=process.env,makeStore=incidentStore,makeDb=createClient,run=coordinate,makeReader=statusCakeReader,check=probe}={}){
  if(env.GITHUB_REPOSITORY!=='teeleebiz-web/aiconfidenceacademy-site'||env.GITHUB_REF!=='refs/heads/main'||!['schedule','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)||!/^\d+$/.test(env.GITHUB_RUN_ID||''))throw new Error('Unreviewed coordinator execution context')
  const config=incidentConfiguration(env)
  try{
    const store=makeStore(config)
    if(env.ACA_INCIDENT_MODE==='verify-private-storage'){
      if(env.GITHUB_EVENT_NAME!=='workflow_dispatch')throw new Error('Storage verification requires a controlled run')
      await store.verify(env.GITHUB_RUN_ID);return {verification:true}
    }
    if(env.ACA_INCIDENT_MODE && !['collect','verify-provider'].includes(env.ACA_INCIDENT_MODE))throw new Error('Unknown coordinator mode')
    if(!env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY)throw new Error('Coordinator database access is missing')
    const db=makeDb(`https://${projectRef}.supabase.co`,env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(6000)})}})
    // Lazy API construction lets a disabled policy remain safely held without a
    // provider token. No provider token ever reaches storage, reports or stdout.
    const readProvider=(...args)=>makeReader(env.ACA_STATUSCAKE_TOKEN)(...args)
    const readPolicy=async()=>checked(await db.from('aca_incident_settings').select('enabled,activated_at,monitors,contact_group').eq('id',true).single())
    if(env.ACA_INCIDENT_MODE==='verify-provider'){
      if(env.GITHUB_EVENT_NAME!=='workflow_dispatch')throw new Error('Provider verification requires a controlled run')
      // Validate the privately configured identities without activating policy,
      // saving cursor state, creating reports or retaining historical alerts.
      const now=new Date(),policy=validatePolicy({...await readPolicy(),enabled:true,activated_at:now.toISOString()},+now)
      for(const role of ['website','backend']){
        const current=validateMonitor(role,policy.monitors[role],await readProvider(policy.monitors[role]),policy)
        if(current.paused||current.status!=='up')throw new Error('Monitoring target needs review')
        parseAlerts(await readProvider(policy.monitors[role],'alerts',Math.floor(+now/1000)),Math.floor(+now/1000),+new Date())
        if(!(await check(role)).ready)throw new Error('Live target needs review')
      }
      return {providerVerification:true}
    }
    return await run({store,readProvider,
      readPolicy,
      mirror:async report=>{checked(await db.rpc('aca_ingest_incident_report',{p_report:report}))},
      heartbeat:async value=>{checked(await db.from('aca_incident_coordinator').upsert({id:true,...value,workflow_run_id:env.GITHUB_RUN_ID},{onConflict:'id'}))},
    })
  }finally{config.key.fill(0)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  runIncidentCoordinator().then(result=>console.log(result.verification?'Private incident storage verification passed.':result.providerVerification?'Read-only monitoring API and fixed target verification passed.':result.held?'Incident coordinator is held pending activation.':result.synchronized?'Incident coordinator completed.':'Private evidence retained; database synchronization needs review.')).catch(()=>{console.error('Incident coordinator needs review; no repair was performed.');process.exitCode=1})
}
