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
