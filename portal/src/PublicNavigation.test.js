import { beforeEach, afterEach, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => {
  document.querySelectorAll('head style').forEach(style => style.remove())
  vi.restoreAllMocks()
})
const load = () => import('../../site.js')
const fixture = () => {
  document.body.innerHTML = `<header>Academy</header><main><section id="intro"><h1>Overview</h1></section><div><section id="begin"><h2>Begin with confidence</h2><input aria-label="Your note" value="Keep my work"></section><section id="everyday"><h2>Everyday uses</h2></section></div></main><footer>Contact</footer>`
}
it('opens a nested section as a focused view without moving or replacing its controls', async () => {
  history.replaceState({}, '', '/explore/?section=begin')
  fixture()
  const field = document.querySelector('input')
  const handler = vi.fn(); field.addEventListener('change', handler)
  await load()
  expect(document.querySelector('#intro').hidden).toBe(true)
  expect(document.querySelector('#everyday').hidden).toBe(true)
  expect(document.querySelector('#begin').closest('[hidden]')).toBeNull()
  expect(document.querySelector('input')).toBe(field)
  expect(field.value).toBe('Keep my work')
  field.dispatchEvent(new Event('change')); expect(handler).toHaveBeenCalledOnce()
  expect(document.activeElement.textContent).toBe('Begin with confidence')
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  expect(document.querySelector('.aca-view-navigation a').pathname).toBe('/explore/')
})
it('upgrades existing section links and bookmarks while preserving private and skip hashes', async () => {
  history.replaceState({}, '', '/explore/#begin'); fixture()
  document.body.insertAdjacentHTML('beforeend', '<a id="topic" href="/videos#explore-chatgpt">Video topic</a><a id="case" href="/contact/#case=private">Case</a><a id="skip" href="#main">Skip</a>')
  await load()
  expect(location.hash).toBe(''); expect(location.search).toBe('?section=begin')
  expect(new URL(document.querySelector('#topic').href).search).toBe('?section=explore-chatgpt')
  expect(document.querySelector('#case').hash).toBe('#case=private')
  expect(document.querySelector('#skip').hash).toBe('#main')
})
it.each(['provider-announcements', 'practical-guidance', 'official-sources'])('shows only the selected resources view: %s', async selected => {
  history.replaceState({}, '', `/library/ai-updates/?section=${selected}`)
  document.body.innerHTML = '<main><section><h1>AI updates</h1></section>' + ['provider-announcements', 'practical-guidance', 'official-sources'].map(id => `<section id="${id}"><h2>${id}</h2></section>`).join('') + '</main>'
  await load()
  const selectedLink = document.querySelector('.aca-view-tabs [aria-current="page"]')
  expect(new URL(selectedLink.href).searchParams.get('section')).toBe(selected)
  for (const id of ['provider-announcements', 'practical-guidance', 'official-sources']) expect(document.getElementById(id).hidden).toBe(id !== selected)
})
it('keeps the overview available for a missing or invalid destination', async () => {
  history.replaceState({}, '', '/explore/?section=unknown'); fixture()
  await load()
  expect(document.querySelectorAll('[hidden]')).toHaveLength(0)
  expect(document.querySelector('.aca-view-navigation')).toBeNull()
})

it('adds Ask ACA as the active public navigation destination', async () => {
  history.replaceState({}, '', '/ask/')
  document.body.innerHTML='<nav id="site-navigation"><a href="/library" class="active">Resources</a><a href="/enroll">Enroll</a></nav><main><h1>Ask ACA</h1></main>'
  await load()
  expect(document.querySelector('a[aria-current="page"]').getAttribute('href')).toBe('/ask/')
  expect(document.querySelector('a[href="/library"]').classList.contains('active')).toBe(false)
})
