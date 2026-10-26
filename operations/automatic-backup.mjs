import { createClient } from '@supabase/supabase-js'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { manualBackup, manualConfiguration } from './manual-backup.mjs'
import { projectRef } from './recovery.mjs'
import { pruneSnapshot, r2Store, preservedManualBackup } from './r2-transfer.mjs'

export const backupJob = 'storage-backups'
export const backupFormat = 'aca-automatic-backup-v1'
export const pinnedBackup = preservedManualBackup
const checked = result => { if (result.error) throw new Error('Backup activity could not be saved'); return result.data }
const reference = value => /^aca-backups\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value ?? '')
export function verifiedBackup(result) {
  return result?.format === backupFormat && reference(result.reference) &&
    ['liveAcaBackup', 'uploadedAndReadbackVerified', 'savedCopyDecryptionVerified', 'restoredWithOriginalHashesVerified'].every(k => result[k] === true) &&
    Number.isSafeInteger(result.fileCount) && result.fileCount > 0 && Number.isSafeInteger(result.totalBytes) && result.totalBytes > 0 &&
    Number.isSafeInteger(result.encryptedBytes) && result.encryptedBytes > 0
}

export function retentionPlan(rows, keep, replacement) {
  if (!Number.isInteger(keep) || keep < 7 || keep > 30 || !verifiedBackup(replacement)) throw new Error('Invalid backup retention policy')
  const saved = new Map()
  for (const row of [...rows].sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)))) {
    if (row.job !== backupJob || !row.finished_at || !verifiedBackup(row.result) || row.result.prunedAt || row.result.reference === pinnedBackup || saved.has(row.result.reference)) continue
    saved.set(row.result.reference, row)
  }
  // A failed history write, missing replacement, or incomplete listing cannot authorize deletion.
  if (![...saved.values()].some(row => row.result.reference === replacement.reference) || rows.length >= 1000) throw new Error('Backup history needs review before retention')
  const ordered = [...saved.values()]
  const retained = ordered.slice(0, keep)
  if (!retained.some(row => row.result.reference === replacement.reference)) throw new Error('Replacement must remain retained')
  return { retained, prune: ordered.slice(keep) }
}

export async function automaticBackup({ env = process.env, now = () => new Date(), db, runBackup = manualBackup, makeStore = r2Store, prune = pruneSnapshot } = {}) {
  let run, result, stage = 'configuration'
  const identity = { format: backupFormat, workflowRunId: env.GITHUB_RUN_ID, workflowAttempt: env.GITHUB_RUN_ATTEMPT }
  try {
    if (env.GITHUB_REPOSITORY !== 'teeleebiz-web/aiconfidenceacademy-site' || env.GITHUB_REF !== 'refs/heads/main' || !['schedule', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) || !/^\d+$/.test(identity.workflowRunId ?? '') || !/^\d+$/.test(identity.workflowAttempt ?? '')) throw new Error('Unreviewed execution context')
    if (!db) {
      if (!env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY) throw new Error('Missing source access')
      db = createClient(`https://${projectRef}.supabase.co`, env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    }
    stage = 'policy'
    const policy = checked(await db.from('aca_backup_automation').select('*').eq('id', true).single())
    if (!policy?.enabled) return { automatedBackup: false, held: 'not-activated' }
    if (!policy.activated_at || !Number.isInteger(policy.keep_daily) || policy.keep_daily < 7 || policy.keep_daily > 30 || (policy.credential_expires_at && !Number.isFinite(Date.parse(policy.credential_expires_at)))) throw new Error('Invalid activation policy')
    stage = 'activity-start'
    run = checked(await db.from('aca_automation_runs').insert({ job: backupJob, started_at: now().toISOString(), status: 'running', result: identity }).select('id').single())
    if (!run?.id) throw new Error('No backup activity reference')
    stage = 'credential-preflight'
    if (policy.credential_expires_at && Date.parse(policy.credential_expires_at) <= +now() + 3600000) throw new Error('Backup credential expires before a full run can safely finish')
    stage = 'backup-and-recovery'
    // Reuse the proven encryption/readback/decryption/original-hash recovery path.
    const saved = await runBackup({ env })
    result = { ...identity, ...saved }
    if (!verifiedBackup(result)) throw new Error('Saved copy did not prove recovery')
    stage = 'activity-success'
    checked(await db.from('aca_automation_runs').update({ status: 'completed', finished_at: now().toISOString(), result }).eq('id', run.id))
    if (policy.prune_enabled) {
      stage = 'retention'
      const rows = checked(await db.from('aca_automation_runs').select('id,job,result,finished_at').eq('job', backupJob).order('finished_at', { ascending: false }).limit(1000))
      const plan = retentionPlan(rows, policy.keep_daily, result)
      const config = manualConfiguration(env)
      config.key.fill(0)
      const store = makeStore(config.r2)
      for (const old of plan.prune) {
        await prune({ reference: old.result.reference, store, fileCount: old.result.fileCount, encryptedBytes: old.result.encryptedBytes })
        checked(await db.from('aca_automation_runs').update({ result: { ...old.result, prunedAt: now().toISOString() } }).eq('id', old.id))
      }
      result.retention = { kept: plan.retained.length, pruned: plan.prune.length, manualBaselinePreserved: true }
    } else result.retention = { held: 'deletion-not-activated' }
    checked(await db.from('aca_automation_runs').update({ result }).eq('id', run.id))
    return { automatedBackup: true, ...result }
  } catch {
    // Never log provider errors, source paths, secrets, or unverified backup summaries.
    const safe = { ...identity, failed: true, stage }
    if (run?.id) try {
      checked(await db.from('aca_automation_runs').update({ status: verifiedBackup(result) ? 'warning' : 'failed', finished_at: now().toISOString(), result: verifiedBackup(result) ? { ...result, ...safe } : safe }).eq('id', run.id))
    } catch { /* Independent monitoring detects missing/unfinished history. */ }
    const error = new Error('Automatic ACA backup needs review')
    error.stage = stage
    throw error
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  automaticBackup().then(value => console.log(JSON.stringify(value))).catch(error => {
    console.error(JSON.stringify({ automatedBackup: false, failed: true, stage: error.stage ?? 'initialization' }))
    process.exitCode = 1
  })
}
