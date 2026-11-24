import '@testing-library/react'

// Unit fixtures must never contact a real service or a placeholder host.
// Individual tests replace this function with their explicit response mock.
// The separately authorized live fixture remains an opt-in integration test.
const liveFixture = (globalThis as {process?: {env?: {ACA_TRIAL_FIXTURE_FILE?: string}}}).process?.env?.ACA_TRIAL_FIXTURE_FILE
if (!liveFixture) {
  globalThis.fetch = async () => { throw new Error('Unit tests must mock fetch; network access is disabled.') }
}

afterEach(() => {
  document.body.innerHTML = ''
})

// jsdom exposes plain arrays for media track lists. Browsers expose EventTargets;
// supply that contract so the player can subscribe without contacting media URLs.
for (const property of ['audioTracks', 'videoTracks', 'textTracks'] as const) {
  const lists = new WeakMap<HTMLMediaElement, unknown>()
  Object.defineProperty(HTMLMediaElement.prototype, property, {
    configurable: true,
    get() {
      if (!lists.has(this)) {
        const events = new EventTarget()
        lists.set(this, Object.assign([], {
          addEventListener: events.addEventListener.bind(events),
          removeEventListener: events.removeEventListener.bind(events),
          dispatchEvent: events.dispatchEvent.bind(events),
        }))
      }
      return lists.get(this)
    },
  })
}
