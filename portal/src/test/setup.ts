import '@testing-library/react'

// Unit fixtures must never contact a real service or a placeholder host.
// Individual tests replace this function with their explicit response mock.
// The separately authorized live fixture remains an opt-in integration test.
if (!process.env.ACA_TRIAL_FIXTURE_FILE) {
  globalThis.fetch = async () => { throw new Error('Unit tests must mock fetch; network access is disabled.') }
}

afterEach(() => {
  document.body.innerHTML = ''
})
