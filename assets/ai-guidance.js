const list = document.getElementById('ai-updates-list')
const status = document.getElementById('ai-updates-status')
const refresh = document.getElementById('ai-updates-refresh')
const endpoint = location.hostname.endsWith('.vercel.app') ? '/api/resources/updates' : 'https://checkout.aiconfidenceacademy.org/api/resources/updates'
const node = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el }
const date = value => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
async function load() {
  refresh.disabled = true
  status.textContent = 'Checking the available sources…'
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(18000), cache: 'no-store', credentials: 'omit' })
    if (!response.ok) throw Error('unavailable')
    const data = await response.json()
    list.replaceChildren()
    for (const item of data.items) {
      const url = new URL(item.url)
      if (url.protocol !== 'https:' || !['openai.com', 'blog.google'].includes(url.hostname)) continue
      const card = node('article', ''); card.className = 'aca-guidance-card'
      const link = node('a', item.title); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'
      const heading = node('h3', ''); heading.append(link)
      card.append(node('small', `${item.source} · Published ${date(item.published)}`), heading, node('p', 'Read the announcement, then check availability and relevance to your own task.'), node('small', `Collected ${date(item.collectedAt)}`))
      list.append(card)
    }
    const unavailable = data.sources.filter(s => s.status !== 'ok').map(s => s.label)
    status.textContent = `${data.items.length ? 'Headlines checked' : 'No dated headlines available'} ${new Date(data.checkedAt).toLocaleString()}.${unavailable.length ? ` Unavailable: ${unavailable.join(', ')}. Use the source links below.` : ''}`
  } catch {
    list.replaceChildren()
    status.textContent = 'Headlines are temporarily unavailable. You can still read the guidance and open the official sources below.'
  } finally { refresh.disabled = false }
}
refresh?.addEventListener('click', load)
if (list && status && refresh) void load()
