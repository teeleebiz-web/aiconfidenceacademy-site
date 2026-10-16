// Preserve browser query parameters when Vercel's catch-all route rewrites the path.
export function routedRequestUrl(request, path) {
  if (typeof path !== 'string') return request.url
  const original = new URL(request.url, 'http://localhost')
  const target = new URL('/' + path.replace(/^\/+/, ''), 'http://localhost')
  for (const [key, value] of original.searchParams) {
    if (key !== '__aca_path') target.searchParams.append(key, value)
  }
  for (const [key, value] of Object.entries(request.query || {})) {
    if (key === '__aca_path' || target.searchParams.has(key) || value == null) continue
    for (const item of Array.isArray(value) ? value : [value]) target.searchParams.append(key, String(item))
  }
  return target.pathname + target.search
}
