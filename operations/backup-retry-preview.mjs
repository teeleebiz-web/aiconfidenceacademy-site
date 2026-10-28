import { backupFailureEvidence } from './backup-failure.mjs'

// Proposed limits for review. No production runner imports this module.
// A preview cannot grant execution authority, even for an eligible candidate.
export const proposedRetryLimits = Object.freeze({
  enabled: false,
  extraAttemptsPerRun: 1,
  extraAttemptsPerBangkokDay: 1,
  cooldownMs: 5 * 60 * 1000,
  retryDeadlineMs: 10 * 60 * 1000,
  maxSourceBytes: 2 * 1024 ** 3,
  maxEncryptedBytes: 2 * 1024 ** 3,
})
const integer = value => Number.isSafeInteger(value) && value >= 0
const bangkokDay = time => new Date(time + 7 * 3600000).toISOString().slice(0, 10)

export function previewBackupRetry({ error, context, ledger, now } = {}) {
  const failure = backupFailureEvidence(error)
  const result = (candidate, reason, details = {}) => Object.freeze({
    preview: true, candidate, reason, retry_authorized: false,
    category: failure.category, operation: failure.operation, ...details,
  })
  if (!integer(now) || now > 8640000000000000 - 86400000) return result(false, 'invalid_clock')
  if (!['service_unavailable', 'network_interruption'].includes(failure.category)
      || !['source_list', 'source_download'].includes(failure.operation)) return result(false, 'ineligible_failure')
  // These facts must eventually come from the running backup, not provider text
  // or a caller's serialized historical failure record. Missing facts fail closed.
  if (context?.job !== 'storage-backups' || context?.ref !== 'refs/heads/main'
      || context?.workflowAttempt !== 1 || context?.stage !== 'source-snapshot'
      || context?.privateStoreTouched !== false || context?.cleanupCompleted !== true
      || context?.ownsLock !== true || context?.activeBackupCount !== 1
      || context?.policyEnabled !== true || context?.historyHealthy !== true
      || !integer(context?.failedAt) || context.failedAt > now
      || !integer(context?.deadlineAt) || !integer(context?.credentialExpiresAt)
      || !integer(context?.providerNotBefore)) return result(false, 'unproven_execution_state')
  if (!integer(context.extraAttempts) || context.extraAttempts >= proposedRetryLimits.extraAttemptsPerRun) return result(false, 'run_limit')
  if (context.sourceLimitBytes !== proposedRetryLimits.maxSourceBytes
      || context.encryptedLimitBytes !== proposedRetryLimits.maxEncryptedBytes) return result(false, 'unproven_transfer_bounds')
  const notBefore = Math.max(context.failedAt + proposedRetryLimits.cooldownMs, context.providerNotBefore)
  const startsAt = Math.max(now, notBefore)
  const endsBy = startsAt + proposedRetryLimits.retryDeadlineMs
  if (endsBy > context.deadlineAt) return result(false, 'insufficient_time')
  if (context.credentialExpiresAt <= endsBy + 3600000) return result(false, 'credential_expiry')
  const quotaDay = bangkokDay(startsAt)
  if (ledger?.complete !== true || ledger?.day !== quotaDay
      || !integer(ledger?.extraAttempts) || !integer(ledger?.unresolvedClaims)) return result(false, 'unproven_daily_history')
  if (ledger.unresolvedClaims > 0) return result(false, 'uncertain_previous_attempt')
  if (ledger.extraAttempts >= proposedRetryLimits.extraAttemptsPerBangkokDay) return result(false, 'daily_limit')
  return result(true, now < notBefore ? 'cooldown' : 'eligible_for_review', { notBefore, endsBy, quotaDay })
}
