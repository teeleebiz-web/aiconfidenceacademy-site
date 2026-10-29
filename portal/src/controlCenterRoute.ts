export const controlCenterPath = '/control-center/'
export const controlCenterReturnKey = 'aca.control-center-return.v1'

// Only an authentication callback may consume this short-lived navigation hint.
// It contains no email, credentials, token, or authorization grant.
export function isControlCenterEntry(url: URL, storage: Pick<Storage, 'getItem'>, now = Date.now()) {
  if (/^\/control-center\/?$/.test(url.pathname)) return true
  if (!/^\/learn\/?$/.test(url.pathname)) return false
  if (url.searchParams.get('view')==='trial-access') return false
  if (['enrollments', 'operations'].includes(url.searchParams.get('view') || '')) return true
  const callback = url.searchParams.has('code') || /(?:^#|&)(?:access_token|error|error_code)=/.test(url.hash)
  if (!callback) return false
  try {
    const expiry = Number(storage.getItem(controlCenterReturnKey))
    return expiry > now && expiry <= now + 60 * 60 * 1000
  } catch { return false }
}
