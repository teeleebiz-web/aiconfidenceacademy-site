export const sources = Object.freeze([
  { id: 'openai', label: 'OpenAI', url: 'https://openai.com/news/rss.xml', host: 'openai.com' },
  { id: 'google', label: 'Google AI', url: 'https://blog.google/innovation-and-ai/technology/ai/rss/', host: 'blog.google' },
])
const text = value => String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|apos|#39);/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"})[x]).trim()
const field = (xml, tag) => text(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\/${tag}>`, 'i').exec(xml)?.[1])
export function parseFeed(xml, source, now = Date.now()) {
  if (Buffer.byteLength(xml) > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml) || !/<rss[\s>]/i.test(xml)) throw Error('Invalid feed')
  const items = []
  const seen = new Set()
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const title = field(match[1], 'title'), link = field(match[1], 'link'), timestamp = Date.parse(field(match[1], 'pubDate'))
    if (!title || title.length > 300 || !Number.isFinite(timestamp) || timestamp > now + 300000 || now - timestamp > 90 * 86400000) continue
    let url
    try { url = new URL(link) } catch { continue }
    if (url.protocol !== 'https:' || url.hostname !== source.host || url.username || url.password || url.port || seen.has(url.href)) continue
    seen.add(url.href)
    items.push({ title, url: url.href, source: source.label, sourceId: source.id, published: new Date(timestamp).toISOString(), collectedAt: new Date(now).toISOString() })
  }
  return items.sort((a,b) => b.published.localeCompare(a.published)).slice(0,6)
}
async function boundedBody(response) {
  if (!response.body) throw Error('Empty feed')
  const reader = response.body.getReader(); const chunks = []; let bytes = 0
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 2 * 1024 * 1024) throw Error('Feed too large'); chunks.push(value) }
  } finally { await reader.cancel().catch(() => {}) }
  return Buffer.concat(chunks).toString('utf8')
}
export function createUpdatesService({ fetcher = fetch, clock = Date.now, ttl = 15 * 60000 } = {}) {
  let cached, pending
  return async function updates() {
    if (cached && clock() - Date.parse(cached.checkedAt) < ttl) return cached
    if (pending) return pending
    pending = (async () => {
      const now = clock()
      const results = await Promise.all(sources.map(async source => {
        try {
          const response = await fetcher(source.url, { redirect: 'error', signal: AbortSignal.timeout(6000), headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'ACA-Resources/1.0' } })
          if (!response.ok) throw Error('Feed unavailable')
          const items = parseFeed(await boundedBody(response), source, now)
          return { source: { id: source.id, label: source.label, status: items.length ? 'ok' : 'no_recent_items' }, items }
        } catch { return { source: { id: source.id, label: source.label, status: 'unavailable' }, items: [] } }
      }))
      cached = { checkedAt: new Date(now).toISOString(), sources: results.map(r=>r.source), items: results.flatMap(r=>r.items).sort((a,b)=>b.published.localeCompare(a.published)).slice(0,12) }
      return cached
    })()
    try { return await pending } finally { pending = null }
  }
}
const updates = createUpdatesService()
export async function handleUpdates(req, res) {
  const origin = req.headers.origin
  if (origin && origin !== 'https://aiconfidenceacademy.org' && origin !== `https://${req.headers.host}`) { res.writeHead(403); res.end(); return }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Cache-Control', 'public, max-age=60')
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405, { Allow:'GET, HEAD' }); res.end(); return }
  const result = await updates()
  res.writeHead(200, { 'Content-Type':'application/json' })
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify(result))
}
