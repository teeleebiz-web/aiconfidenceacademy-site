import { setTimeout as wait } from 'node:timers/promises'
import { fork } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { manualRetryEvidence } from './manual-backup.mjs'
import { previewBackupRetry, proposedRetryLimits as limits } from './backup-retry-preview.mjs'

// Approval covers implementation/testing only. No environment variable enables it.
export const liveRetryEnabled = false
const day = t => new Date(t + 7 * 3600000).toISOString().slice(0, 10)
const checked = r => { if (r?.error || !r?.data) throw new Error('Retry history unavailable'); return r.data }

// A separate process bounds the entire extra copy, including blocked streams,
// local encryption, upload and recovery. A timeout waits for confirmed exit.
export function isolatedRetry({ env, deadlineAt, now = Date.now, worker = new URL('./backup-retry-worker.mjs', import.meta.url) }) {
  return new Promise((resolve, reject) => {
    const budget = Math.min(limits.retryDeadlineMs, deadlineAt - now())
    if (!Number.isFinite(budget) || budget <= 0) return reject(new Error('Retry deadline elapsed'))
    const started = performance.now()
    const child = fork(worker, [], { env, execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
    let result, expired = false, failed = false
    const timer = setTimeout(() => { expired = true; child.kill('SIGKILL') }, budget)
    child.on('message', message => { if (result !== undefined) failed = true; result = message })
    child.on('error', () => { failed = true; child.kill('SIGKILL') })
    child.on('close', code => {
      clearTimeout(timer)
      if (expired || failed || performance.now() - started > budget || now() >= deadlineAt || code !== 0 || !result) return reject(new Error('Retry did not finish within its budget'))
      resolve(result)
    })
  })
}

export async function retryBackup({ error, env, db, runId, deadlineAt,
  enabled = liveRetryEnabled, now = Date.now, sleep = ms => wait(ms),
  runAttempt = isolatedRetry, evidenceFor = manualRetryEvidence } = {}) {
  if (!enabled) throw error
  const facts = evidenceFor(error)
  if (!facts || env?.GITHUB_REPOSITORY !== 'teeleebiz-web/aiconfidenceacademy-site'
      || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_RUN_ATTEMPT !== '1'
      || !['schedule', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)
      || !/^\d+$/.test(env.GITHUB_RUN_ID ?? '') || !Number.isSafeInteger(deadlineAt)) throw error
  const initialTime = now()
  const earliest = Math.max(initialTime, facts.failedAt + limits.cooldownMs, facts.providerNotBefore ?? Infinity)
  if (!Number.isSafeInteger(earliest) || earliest + limits.retryDeadlineMs > deadlineAt) throw error
  const stateAt = async t => checked(await db.rpc('aca_backup_retry_state', { p_run_id: runId, p_start_at: new Date(t).toISOString() }))
  const decide = (state, t) => previewBackupRetry({ error, now: t,
    context: { ...facts, job: 'storage-backups', ref: env.GITHUB_REF, workflowAttempt: 1,
      deadlineAt, credentialExpiresAt: Date.parse(state.credential_expires_at),
      ownsLock: state.run_valid === true, activeBackupCount: state.active_count,
      policyEnabled: state.policy_enabled === true && state.retry_enabled === true,
      historyHealthy: state.history_healthy === true, extraAttempts: state.run_attempts },
    ledger: { complete: state.history_healthy === true, day: state.quota_day,
      extraAttempts: state.day_attempts, unresolvedClaims: state.unresolved_claims } })
  let decision = decide(await stateAt(earliest), initialTime)
  if (!decision.candidate) throw error
  // Long waits are split; after waiting the database and clock are checked anew.
  while (now() < decision.notBefore) await sleep(Math.min(30000, decision.notBefore - now()))
  const current = now()
  decision = decide(await stateAt(current), current)
  if (!decision.candidate || decision.reason === 'cooldown') throw error
  const claim = checked(await db.rpc('aca_reserve_backup_retry', {
    p_run_id: runId, p_workflow_run_id: env.GITHUB_RUN_ID,
    p_day: day(current), p_not_before: new Date(decision.notBefore).toISOString(),
    p_deadline: new Date(decision.endsBy).toISOString(),
  }))
  if (claim.reserved !== true || !claim.id) throw error
  // A lost reservation response never runs the child. The durable row stays spent.
  try {
    if (day(now()) !== claim.quota_day || now() >= decision.endsBy) throw new Error('Retry start boundary changed')
    const begun = checked(await db.rpc('aca_begin_backup_retry', { p_claim_id: claim.id }))
    if (begun.started !== true) throw new Error('Retry start denied')
    const result = await runAttempt({ env, deadlineAt: Math.min(decision.endsBy, Date.parse(begun.deadline_at)) })
    if (!['liveAcaBackup', 'uploadedAndReadbackVerified', 'savedCopyDecryptionVerified', 'restoredWithOriginalHashesVerified'].every(k => result?.[k] === true)
        || !/^aca-backups\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result.reference ?? '')
        || !['fileCount', 'totalBytes', 'encryptedBytes'].every(k => Number.isSafeInteger(result[k]) && result[k] > 0)) throw new Error('Retry recovery not verified')
    checked(await db.rpc('aca_finish_backup_retry', { p_claim_id: claim.id, p_outcome: 'completed' }))
    return result
  } catch {
    // Never clear/release an allowance; failed or ambiguous outcomes cannot recur.
    try { checked(await db.rpc('aca_finish_backup_retry', { p_claim_id: claim.id, p_outcome: 'failed' })) } catch { /* unresolved claim blocks future attempts */ }
    throw error
  }
}
