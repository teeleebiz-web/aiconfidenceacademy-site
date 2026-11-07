export const askAcaPath = '/learn/?view=ask-aca'
export const askAcaReturnKey = 'aca.ask-aca-return.v1'

// A navigation hint only; it never grants access or contains account data.
export function isAskAcaEntry(url: URL, storage: Pick<Storage, 'getItem'>, now = Date.now()) {
  if (!/^\/learn\/?$/.test(url.pathname)) return false
  if (url.searchParams.get('view') === 'ask-aca') return true
  if (url.searchParams.has('view') || url.searchParams.has('course') || url.searchParams.has('review')) return false
  const callback = url.searchParams.has('code') || /(?:^#|&)(?:access_token|error|error_code)=/.test(url.hash)
  if (!callback) return false
  try {
    const expires = Number(storage.getItem(askAcaReturnKey))
    return expires > now && expires <= now + 60 * 60 * 1000
  } catch { return false }
}
