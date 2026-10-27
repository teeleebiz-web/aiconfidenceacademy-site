import { createHash } from 'node:crypto'

export const targets = Object.freeze({website:'https://aiconfidenceacademy.org/',backend:'https://checkout.aiconfidenceacademy.org/api/health'})
export const diagnoses = Object.freeze({
  website_unavailable:'The public website did not pass both checks. Inspect its publication, domain and hosting evidence.',
  backend_readiness_failed:'The backend reported that its database readiness check failed. The underlying cause still needs investigation.',
  backend_unavailable:'The backend did not pass both checks. Inspect its deployment and database service.',
  both_unavailable:'Both addresses failed confirmation. A shared domain, network or provider problem is possible; the cause is unconfirmed.',
  monitor_disagreement:'The monitoring event and current checks disagree. Investigate an intermittent failure or monitoring configuration.',
  recovered:'StatusCake and two current checks confirm availability again. No repair was performed by this coordinator.',
})
const roles = Object.keys(targets)
const validDate = value => typeof value==='string' && Number.isFinite(Date.parse(value))
export const digest = value => createHash('sha256').update(value).digest('hex')

export function validatePolicy(value, now=Date.now()) {
  if (!value || typeof value.enabled!=='boolean') throw new Error('Coordinator policy is invalid')
  if (!value.enabled) return {enabled:false}
  if (!validDate(value.activated_at) || Date.parse(value.activated_at)>now || !value.monitors ||
      !roles.every(role=>typeof value.monitors[role]==='string' && /^\d+$/.test(value.monitors[role])) ||
      value.monitors.website===value.monitors.backend || typeof value.contact_group!=='string' || !/^\d+$/.test(value.contact_group)) throw new Error('Coordinator activation is invalid')
  return {enabled:true,activated_at:new Date(value.activated_at).toISOString(),monitors:Object.fromEntries(roles.map(role=>[role,value.monitors[role]])),contact_group:value.contact_group}
}

// All destinations and methods are fixed in source. Provider payloads cannot
// choose a destination, execute a command, inject a repair or request a write.
export function statusCakeReader(token, {fetcher=fetch,timeoutMs=10000}={}) {
  if (typeof token!=='string' || token.length<16 || /\s/.test(token)) throw new Error('Monitoring API access is missing')
  return async (id,resource='',after) => {
    if (!/^\d+$/.test(id) || !['','alerts'].includes(resource) || (after!==undefined && (!Number.isSafeInteger(after)||after<0))) throw new Error('Invalid monitoring read')
    const path=`https://api.statuscake.com/v1/uptime/${id}${resource?'/'+resource:''}${resource?`?limit=100&after=${after}`:''}`
    const res=await fetcher(path,{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(timeoutMs)})
    if (!res.ok) throw new Error('Monitoring API read failed')
    const raw=await boundedText(res,128*1024)
    try{return JSON.parse(raw)}catch{throw new Error('Monitoring API response is invalid')}
  }
}

async function boundedText(res,limit) {
  if (!res.body) return ''
  const reader=res.body.getReader(),chunks=[];let size=0
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new Error('Response is too large');chunks.push(value)}}
  finally{await reader.cancel().catch(()=>{})}
  return Buffer.concat(chunks).toString('utf8')
}

export async function probe(role,{fetcher=fetch,timeoutMs=12000}={}) {
  if (!roles.includes(role)) throw new Error('Unknown monitoring target')
  try {
    const res=await fetcher(targets[role],{method:'GET',headers:{'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(timeoutMs)})
    let readiness=null
    if(role==='backend' && [200,503].includes(res.status)){
      try{const value=JSON.parse(await boundedText(res,1024));if(value.service==='aca-backend'&&['ok','unavailable'].includes(value.status))readiness=value.status}catch{ /* Generic invalid readiness, never retain body content. */ }
    }else await res.body?.cancel().catch(()=>{})
    return {code:res.status,ready:res.status===200&&(role!=='backend'||readiness==='ok'),readiness,error:null}
  }catch{return {code:null,ready:false,readiness:null,error:'request_failed'}}
}

export function validateMonitor(role,id,value,policy) {
  const d=value?.data
  if (!roles.includes(role) || d?.id!==id || d.website_url!==targets[role] || d.test_type!=='HTTP' ||
      !['up','down'].includes(d.status) || typeof d.paused!=='boolean' || d.check_rate!==300 ||
      !Array.isArray(d.contact_groups) || !d.contact_groups.includes(policy.contact_group)) throw new Error('Monitoring configuration needs review')
  return {status:d.status,paused:d.paused}
}

export function parseAlerts(value,after,now=Date.now()) {
  if (!Array.isArray(value?.data) || value.data.length>=100 || value.links?.next) throw new Error('Monitoring history needs pagination review')
  const seen=new Set()
  return value.data.map(a=>{
    if (typeof a.id!=='string'||!/^\d+$/.test(a.id)||!['up','down'].includes(a.status)||!validDate(a.triggered_at)||Date.parse(a.triggered_at)>now+300000||Date.parse(a.triggered_at)<after*1000||seen.has(a.id))throw new Error('Monitoring alert is invalid')
    seen.add(a.id)
    return {id:a.id,status:a.status,at:new Date(a.triggered_at).toISOString(),code:Number.isInteger(a.status_code)&&a.status_code>=0&&a.status_code<=599?a.status_code:null}
  }).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id,undefined,{numeric:true}))
}

export function classify(role,provider,samples) {
  const affected=samples[role]
  if(provider==='up' && affected.every(s=>s.ready))return 'recovered'
  if(affected.some(s=>s.ready))return 'monitor_disagreement'
  if(roles.every(r=>samples[r].every(s=>!s.ready)))return 'both_unavailable'
  if(role==='website')return 'website_unavailable'
  return affected.every(s=>s.code===503&&s.readiness==='unavailable')?'backend_readiness_failed':'backend_unavailable'
}

const emptyState = () => ({version:1,policy:null,monitors:{},reports:[]})
// A single fixed encrypted state object is serialized by the workflow concurrency
// group. Immutable evidence versions are saved before its cursor advances.
export async function coordinate({readPolicy,store,readProvider,mirror,heartbeat,check=probe,now=()=>new Date(),pause=ms=>new Promise(r=>setTimeout(r,ms))}) {
  let state=await store.load() || emptyState()
  if(state.version!==1 || !Array.isArray(state.reports) || state.reports.length>50 || !state.monitors)throw new Error('Private coordinator state needs review')
  let policy,fresh,unreachable=false
  try{fresh=await readPolicy()}catch{unreachable=true}
  if(unreachable){if(!state.policy)throw new Error('Coordinator policy is unavailable');policy=validatePolicy(state.policy,+now())}
  else{policy=validatePolicy(fresh,+now());state.policy=policy;await store.save(state)}
  if(!policy.enabled)return {held:true}
  const time=now().toISOString()
  const drain=async()=>{for(const item of state.reports.filter(r=>!r.synced)){try{await mirror(item.report);item.synced=true}catch{break}}}
  await drain()
  await store.save(state)
  let samples
  // Separate rounds beyond the readiness endpoint's 15-second internal cache.
  const evidence=async()=>{
    if(!samples){samples={website:[],backend:[]};for(let n=0;n<2;n++){for(const role of roles)samples[role].push(await check(role));if(!n)await pause(16000)}}
    return samples
  }
  for(const role of roles){
    const id=policy.monitors[role],current=validateMonitor(role,id,await readProvider(id),policy)
    if(current.paused)continue
    const cursor=state.monitors[role] || {after:Math.floor(Date.parse(policy.activated_at)/1000),seen:[],open:null}
    const alerts=parseAlerts(await readProvider(id,'alerts',Math.max(Math.floor(Date.parse(policy.activated_at)/1000),cursor.after-1)),Math.max(Math.floor(Date.parse(policy.activated_at)/1000),cursor.after-1),+now())
    for(const alert of alerts){
      if(Date.parse(alert.at)<Date.parse(policy.activated_at))continue
      if(cursor.seen.includes(alert.id))continue
      if(alert.status==='down'&&!cursor.open){
        const report={id:digest(`${role}:${alert.id}`),role,source_at:alert.at,observed_at:time,resolved_at:null,status:'open',diagnosis:'monitor_disagreement',provider_status:current.status,source_code:alert.code,samples:null,repair_performed:false}
        state.reports.push({report,synced:false});cursor.open=report.id
      }
      // Up events are not a recovery assertion by themselves. Current provider
      // status and two live checks must independently agree below.
      cursor.seen.push(alert.id);cursor.seen=cursor.seen.slice(-200);cursor.after=Math.max(cursor.after,Math.floor(Date.parse(alert.at)/1000))
    }
    if(cursor.open){
      const record=state.reports.find(r=>r.report.id===cursor.open)
      if(!record)throw new Error('Open incident evidence is missing')
      const checked=await evidence(),diagnosis=classify(role,current.status,checked)
      const report={...record.report,observed_at:time,provider_status:current.status,diagnosis,samples:checked}
      if(diagnosis==='recovered'){report.status='recovered';report.resolved_at=time;cursor.open=null}
      record.report=report;record.synced=false
      await store.evidence(report)
    }
    state.monitors[role]=cursor
  }
  // Never evict an unsynchronized or open report. Historical encrypted evidence
  // objects remain retained; this bound is only the active cursor/index.
  while(state.reports.length>50){const i=state.reports.findIndex(r=>r.synced&&r.report.status==='recovered');if(i<0)throw new Error('Private incident synchronization needs review');state.reports.splice(i,1)}
  await store.save(state)
  await drain()
  let synchronized=state.reports.every(r=>r.synced)
  await store.save(state)
  try{await heartbeat({checked_at:time,status:synchronized?'completed':'sync_pending'})}catch{synchronized=false}
  return {held:false,synchronized}
}
