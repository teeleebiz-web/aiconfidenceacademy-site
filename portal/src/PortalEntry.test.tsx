import { render, screen } from '@testing-library/react'
import { PortalEntry } from './PortalEntry'
import { controlCenterReturnKey } from './controlCenterRoute'

vi.mock('./App', () => ({ App: () => <h1>Existing learner view</h1> }))
vi.mock('./LearnerEntry', () => ({ LearnerEntry: () => <h1>Shared learner entry</h1> }))
vi.mock('./ControlCenterEntry', () => ({ ControlCenterEntry: () => <h1>Owner entry</h1> }))
vi.mock('./TrialAccessEntry', () => ({ TrialAccessEntry: () => <h1>Trial entry</h1> }))

afterEach(() => {
  window.history.replaceState({}, '', '/learn/')
  window.localStorage.removeItem(controlCenterReturnKey)
})
it.each(['/learn/', '/learn/#access_token=synthetic', '/learn/?code=synthetic'])(
  'uses enrollment-based selection for shared learner entry %s', async path => {
    window.history.replaceState({}, '', path)
    render(<PortalEntry />)
    expect(await screen.findByRole('heading', { name: 'Shared learner entry' })).toBeTruthy()
  },
)
it.each(['/learn/?course=phase-one', '/learn/?review=phase-one&view=curriculum', '/learn/?lesson=5.2', '/learn/?workbook=journey-one', '/learn/?view=trial'])(
  'preserves existing specific learner links %s', async path => {
    window.history.replaceState({}, '', path)
    render(<PortalEntry />)
    expect(await screen.findByRole('heading', { name: 'Existing learner view' })).toBeTruthy()
  },
)
it('keeps direct trial invitations separate from shared sign-in', async () => {
  window.history.replaceState({}, '', '/learn/?view=trial-access#invite=synthetic')
  render(<PortalEntry />)
  expect(await screen.findByRole('heading', { name: 'Trial entry' })).toBeTruthy()
})
it('preserves the existing same-browser owner callback without loading learner selection', async () => {
  window.localStorage.setItem(controlCenterReturnKey, String(Date.now()+600000))
  window.history.replaceState({}, '', '/learn/#access_token=synthetic')
  render(<PortalEntry />)
  expect(await screen.findByRole('heading', { name: 'Owner entry' })).toBeTruthy()
  expect(window.location.pathname).toBe('/control-center/')
  expect(screen.queryByRole('heading', { name: 'Shared learner entry' })).toBeNull()
})
