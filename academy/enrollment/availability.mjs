const website = 'https://aiconfidenceacademy.org/'
const backend = 'https://checkout.aiconfidenceacademy.org/api/health'

// External probes receive only a generic readiness result. They cannot read
// owner/learner records, choose a query, mutate state or trigger operational mail.
export function createAvailabilityHandler({ db, now = Date.now, timeoutMs = 4000, cacheMs = 15000 } = {}) {
  let cache, pending
  async function probe() {
    if (cache && now() - cache.at < cacheMs) return cache.ok
    if (pending) return pending
    pending = (async () => {
      const controller = new AbortController()
      let timer
      try {
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Readiness timeout')) }, timeoutMs)
        })
        const query = Promise.resolve().then(() => db.from('aca_operational_monitor')
          .select('id').eq('id', true).abortSignal(controller.signal).maybeSingle())
        const result = await Promise.race([query, timeout])
        cache = { at: now(), ok: !result.error && result.data?.id === true }
      } catch { cache = { at: now(), ok: false } }
      finally { clearTimeout(timer) }
      return cache.ok
    })()
    try { return await pending } finally { pending = null }
  }
  return async function availability(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method not allowed' })); return
    }
    const ok = await probe()
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' })
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ service: 'aca-backend', status: ok ? 'ok' : 'unavailable' }))
  }
}

// Configuration is evidence of setup, not a live provider status. Never accept
// URLs with credentials, query strings or an arbitrary external destination.
export function externalAvailability(value) {
  const base = { configured: false, website, backend, dashboard_url: null, verified_at: null, interval_seconds: null }
  try {
    const config = typeof value === 'string' ? JSON.parse(value) : value
    const url = new URL(config.dashboard_url)
    if (url.protocol !== 'https:' || url.hostname !== 'app.statuscake.com' || url.port || url.username || url.password || url.search || url.hash) return base
    if (!/^\d+$/.test(config.website_monitor_id) || !/^\d+$/.test(config.backend_monitor_id) || config.website_monitor_id === config.backend_monitor_id) return base
    if (!Number.isFinite(Date.parse(config.verified_at)) || !Number.isInteger(config.interval_seconds) || config.interval_seconds < 300) return base
    return { ...base, configured: true, dashboard_url: url.href, verified_at: config.verified_at, interval_seconds: config.interval_seconds }
  } catch { return base }
}
