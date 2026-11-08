import {probe} from './incident-diagnostics.mjs'

const roles = ['website', 'backend']
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const checked = result => {
  if (result?.error) throw Error('Support investigation database operation failed')
  return result?.data
}

// Keep only typed probe facts. Neither report text nor provider bodies can
// introduce destinations, commands, credentials, account lookups or repairs.
function sample(value,role) {
  if (!value || typeof value.ready !== 'boolean' ||
      !(value.code === null || Number.isInteger(value.code) && value.code >= 100 && value.code <= 599) ||
      ![null, 'ok', 'unavailable'].includes(value.readiness) ||
      ![null, 'request_failed'].includes(value.error) ||
      value.ready && (value.code !== 200 || value.error !== null || role==='backend' && value.readiness!=='ok')) throw Error('Invalid support diagnostic sample')
  return {code:value.code, ready:value.ready, readiness:value.readiness, error:value.error}
}

export function supportDiagnosis(samples) {
  if (roles.every(role => samples[role].every(s => s.ready))) return 'no_shared_outage'
  if (roles.every(role => samples[role].every(s => !s.ready))) return 'both_unavailable'
  if (roles.some(role => samples[role][0].ready !== samples[role][1].ready)) return 'intermittent'
  if (samples.website.every(s => !s.ready)) return 'website_unavailable'
  if (samples.backend.every(s => s.code === 503 && s.readiness === 'unavailable')) return 'backend_readiness_failed'
  return 'backend_unavailable'
}

// First operational increment: durable intake -> actual fixed-target checks ->
// private evidence. A healthy homepage never resolves a reported user-flow bug.
// No model call, repair dispatcher, email sender or coding-agent claim is hidden
// behind this step. Those integrations require their own tested authority.
export async function investigateSupport({db, check=probe, pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)), now=()=>new Date()}) {
  const claims = checked(await db.rpc('aca_claim_support_investigations'))
  if (!Array.isArray(claims) || claims.length > 5) throw Error('Invalid support investigation claims')
  if (!claims.length) return {claimed:0, recorded:0, pending:0}
  for (const claim of claims) {
    if (!uuid.test(claim.case_id) || !uuid.test(claim.claim_token) ||
        !Number.isSafeInteger(claim.generation) || claim.generation < 1 ||
        !['technical','sign-in'].includes(claim.category)) throw Error('Invalid support investigation claim')
  }
  const started = now().toISOString(), samples = {website:[],backend:[]}
  for (let round=0; round<2; round++) {
    for (const role of roles) samples[role].push(sample(await check(role),role))
    if (!round) await pause(16000) // exceeds the health endpoint's 15-second cache
  }
  const report = {version:1, started_at:started, observed_at:now().toISOString(),
    diagnosis:supportDiagnosis(samples), samples, repair_performed:false, user_flow_verified:false}
  let recorded = 0
  for (const claim of claims) {
    const accepted = checked(await db.rpc('aca_complete_support_investigation', {
      p_case_id:claim.case_id, p_claim_token:claim.claim_token,
      p_generation:claim.generation, p_report:report,
    }))
    if (accepted === true) recorded++
    else if (accepted !== false) throw Error('Invalid support investigation completion')
  }
  return {claimed:claims.length, recorded, pending:claims.length-recorded}
}
