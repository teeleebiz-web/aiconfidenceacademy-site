import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ControlCenterEntry } from './ControlCenterEntry'
import { controlCenterReturnKey } from './controlCenterRoute'

const api = vi.hoisted(() => ({
  session: null as null | { access_token: string; user: { id: string } },
  owner: true, ownerError: null as null | { message: string },
  rpc: vi.fn(), from: vi.fn(), otp: vi.fn(), password: vi.fn(), signOut: vi.fn(),
  authChanged: null as null | ((_event: string, session: unknown) => void),
}))
vi.mock('./lib/supabase', () => ({ supabase: {
  from: api.from, rpc: api.rpc,
  auth: {
    getSession: async () => ({ data: { session: api.session }, error: null }),
    onAuthStateChange: (callback: typeof api.authChanged) => {
      api.authChanged = callback
      return { data: { subscription: { unsubscribe() {} } } }
    },
    signInWithOtp: api.otp, signInWithPassword: api.password, signOut: api.signOut,
  },
} }))
vi.mock('./components/AcademyControlCenter', () => ({ AcademyControlCenter: ({ accessToken }: { accessToken: string }) => <main><h1>Control center dashboard</h1><p>{accessToken}</p></main> }))

beforeEach(() => {
  api.session = null; api.owner = true; api.ownerError = null
  api.rpc.mockReset().mockImplementation(async () => ({ data: api.owner, error: api.ownerError }))
  api.from.mockClear(); api.otp.mockReset().mockResolvedValue({ error: null })
  api.password.mockReset().mockResolvedValue({ error: null })
  api.signOut.mockReset().mockResolvedValue({ error: null })
  localStorage.clear()
})
it('shows owner sign-in without enrollment, curriculum, or portal navigation', async () => {
  render(<ControlCenterEntry />)
  expect(await screen.findByRole('heading', { name: 'Academy control center' })).toBeTruthy()
  expect(screen.getByLabelText('Owner email')).toBeTruthy()
  expect(screen.queryByText(/learning journey|learner portal/i)).toBeNull()
  expect(api.from).not.toHaveBeenCalled()
  expect(api.rpc).not.toHaveBeenCalled()
})
it('opens the existing dashboard for an authorized owner without querying learner records', async () => {
  api.session = { access_token: 'synthetic-owner-token', user: { id: 'owner' } }
  render(<ControlCenterEntry />)
  expect(await screen.findByRole('heading', { name: 'Control center dashboard' })).toBeTruthy()
  expect(screen.getByText('synthetic-owner-token')).toBeTruthy()
  expect(api.rpc).toHaveBeenCalledWith('is_aca_curriculum_owner', undefined, { get: true })
  expect(api.from).not.toHaveBeenCalled()
})
it('keeps unauthorized accounts out of both the dashboard and curriculum', async () => {
  api.session = { access_token: 'synthetic-learner-token', user: { id: 'learner' } }; api.owner = false
  render(<ControlCenterEntry />)
  expect(await screen.findByRole('heading', { name: 'Owner access required' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Control center dashboard' })).toBeNull()
  expect(screen.queryByRole('link')).toBeNull()
  expect(api.from).not.toHaveBeenCalled()
})
it('fails closed when owner authorization cannot be verified', async () => {
  api.session = { access_token: 'synthetic-token', user: { id: 'owner' } }; api.ownerError = { message: 'unavailable' }
  render(<ControlCenterEntry />)
  expect(await screen.findByRole('heading', { name: 'Owner access could not be checked' })).toBeTruthy()
  expect(api.from).not.toHaveBeenCalled()
})
it('preserves the control-center destination when requesting an email sign-in', async () => {
  render(<ControlCenterEntry />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Owner email'), 'owner@example.com')
  await user.click(screen.getByRole('button', { name: 'Send my sign-in link' }))
  await waitFor(() => expect(api.otp).toHaveBeenCalledWith({ email: 'owner@example.com', options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/learn/` } }))
  expect(Number(localStorage.getItem(controlCenterReturnKey))).toBeGreaterThan(Date.now())
  expect(api.from).not.toHaveBeenCalled()
})
