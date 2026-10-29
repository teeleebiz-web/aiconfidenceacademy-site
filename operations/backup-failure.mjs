import { StorageApiError } from '@supabase/supabase-js'
import { S3ServiceException } from '@aws-sdk/client-s3'

const categories = new Set(['service_unavailable', 'network_interruption', 'credential_or_access', 'configuration', 'integrity', 'source_changed', 'not_found', 'local_resource', 'history', 'unknown'])
const operations = new Set(['configuration', 'source_list', 'source_download', 'private_write', 'private_read', 'retention', 'integrity_check', 'local_resource', 'history', 'unknown'])
const evidence = new WeakMap()
const retryEvidence = new WeakMap()
export const sourceRetryEvidence = error => retryEvidence.get(error) ?? null
const unknown = Object.freeze({ category: 'unknown', operation: 'unknown', retry_authorized: false })
const interrupted = new Set(['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET'])

// Finite evidence only. Provider bodies, messages, object paths and credentials
// never become history fields or repair instructions. A category is not consent.
export function backupFailure(category, operation, cause) {
  if (!categories.has(category) || !operations.has(operation)) throw new Error('Invalid backup failure evidence')
  const error = new Error(category === 'source_changed' ? 'Storage inventory changed during backup; snapshot rejected' : 'ACA backup operation needs review')
  evidence.set(error, evidence.get(cause) ?? Object.freeze({ category, operation, retry_authorized: false }))
  if (retryEvidence.has(cause)) retryEvidence.set(error, retryEvidence.get(cause))
  return error
}

export function backupFailureEvidence(error) {
  return evidence.get(error) ?? unknown
}

function httpCategory(status) {
  if ([401, 403].includes(status)) return 'credential_or_access'
  if ([408, 429, 502, 503, 504].includes(status)) return 'service_unavailable'
  if (status === 404) return 'not_found'
  // A generic 500 does not establish a temporary fault. Other failures also
  // remain unknown rather than inventing an automatic-retry justification.
  return 'unknown'
}

export function sourceReadFailure(error, operation) {
  if (!['source_list', 'source_download'].includes(operation)) throw new Error('Invalid source failure operation')
  if (evidence.has(error)) {
    const wrapped = backupFailure(evidence.get(error).category, operation)
    if (retryEvidence.has(error)) retryEvidence.set(wrapped, retryEvidence.get(error))
    return wrapped
  }
  // The SDK wraps a rejected fetch in StorageUnknownError. Preserve only our
  // own transport evidence, never similarly named properties from JSON/errors.
  if (error instanceof Error && evidence.has(error.originalError)) return sourceReadFailure(error.originalError, operation)
  if (!(error instanceof StorageApiError)) return backupFailure('unknown', operation)
  const category = error.status === 400 && error.code === 'InvalidChecksum' ? 'integrity' : httpCategory(error.status)
  return backupFailure(category, operation)
}

// Capture only owned transport facts. An absent header is observed, not inferred
// from a saved SDK error. Malformed/overflowing backoff remains unknown.
export function backupSourceFetch(fetcher = fetch, { captureRetry = false, now = Date.now } = {}) {
  return async (...args) => {
    try {
      const response = await fetcher(...args)
      if (captureRetry && response instanceof Response && [408, 429, 502, 503, 504].includes(response.status)) {
        const observedAt = now(), header = response.headers.get('retry-after')
        let providerNotBefore = null
        if (header === null) providerNotBefore = observedAt
        else if (/^\d+$/.test(header)) {
          const delay = Number(header) * 1000
          if (Number.isSafeInteger(delay) && delay <= 86400000) providerNotBefore = observedAt + delay
        } else if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(header)) {
          const parsed = Date.parse(header)
          if (Number.isFinite(parsed)) providerNotBefore = Math.max(observedAt, parsed)
        }
        await response.body?.cancel().catch(() => {})
        const captured = backupFailure('service_unavailable', 'unknown')
        retryEvidence.set(captured, Object.freeze({ observedAt, providerNotBefore }))
        throw captured
      }
      return response
    }
    catch (error) {
      if (retryEvidence.has(error)) throw error
      const code = error instanceof Error ? (error.cause instanceof Error ? error.cause.code : error.code) : null
      const captured = backupFailure(interrupted.has(code) ? 'network_interruption' : 'unknown', 'unknown')
      if (captureRetry && interrupted.has(code)) { const observedAt = now(); retryEvidence.set(captured, Object.freeze({ observedAt, providerNotBefore: observedAt })) }
      throw captured
    }
  }
}

export function privateStoreFailure(error, operation) {
  if (!['private_write', 'private_read', 'retention'].includes(operation)) throw new Error('Invalid private-store failure operation')
  if (evidence.has(error)) return backupFailure('unknown', operation, error)
  return backupFailure(error instanceof S3ServiceException ? httpCategory(error.$metadata?.httpStatusCode) : 'unknown', operation)
}
