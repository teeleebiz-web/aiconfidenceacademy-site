import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LearnerEntry } from './LearnerEntry'

const api = vi.hoisted(() => ({
  getSession: vi.fn(), lookup: vi.fn(), eq: vi.fn(), otp: vi.fn(), password: vi.fn(),
  onAuth: null as null | ((event: string, session: unknown) => void),
}))
vi.mock('./lib/supabase', () => ({ supabase: {
  auth: {
    getSession: api.getSession,
    onAuthStateChange: (callback: typeof api.onAuth) => {
      api.onAuth = callback
      return { data: { subscription: { unsubscribe() {} } } }
    },
    signInWithOtp: api.otp, signInWithPassword: api.password,
    signOut: async () => ({ error: null }),
  },
  from: (table: string) => {
    if (table !== 'enrollments') throw Error('Entry must not open curriculum or a lesson')
    return { select: () => ({ eq: (field: string, userId: string) => {
      api.eq(field, userId)
      return api.lookup(userId)
    } }) }
  },
} }))
vi.mock('./App', () => ({ App: () => <h1>Existing Phase One learning home</h1> }))

const session = (id = 'fictional-learner') => ({ user: { id } })
const phase = (number: 1 | 2) => ({ course: {
  code: number === 1 ? 'phase-one-chatgpt-foundations' : 'phase-two-ai-professional-builder',
  title: `Phase ${number}`,
} })

beforeEach(() => {
  vi.clearAllMocks()
  api.onAuth = null
  api.getSession.mockResolvedValue({ data: { session: session() }, error: null })
  api.lookup.mockResolvedValue({ data: [phase(1)], error: null })
  api.otp.mockResolvedValue({ error: null })
  api.password.mockResolvedValue({ error: null })
})

it('restores an existing Phase One session without asking for another email or starting a lesson', async () => {
  const open = vi.fn()
  render(<LearnerEntry onOpenPhaseTwo={open} />)
  expect(await screen.findByRole('heading', { name: 'Existing Phase One learning home' })).toBeTruthy()
  expect(api.eq).toHaveBeenCalledWith('learner_id', 'fictional-learner')
  expect(screen.queryByLabelText('Enrollment email')).toBeNull()
  expect(api.otp).not.toHaveBeenCalled()
  expect(open).not.toHaveBeenCalled()
})

it('routes a Phase Two-only learner to the existing Phase Two entry', async () => {
  api.lookup.mockResolvedValue({ data: [phase(2)], error: null })
  const open = vi.fn()
  render(<LearnerEntry onOpenPhaseTwo={open} />)
  await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('heading', { name: 'Existing Phase One learning home' })).toBeNull()
})

it('lets a learner enrolled in both phases choose without opening either lesson', async () => {
  api.lookup.mockResolvedValue({ data: [phase(2), phase(1), phase(2)], error: null })
  const open = vi.fn()
  render(<LearnerEntry onOpenPhaseTwo={open} />)
  expect(await screen.findByRole('heading', { name: 'Choose your learning phase' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Open Phase One' }).getAttribute('href')).toBe('/learn/?course=phase-one')
  expect(screen.getByRole('link', { name: 'Open Phase Two' }).getAttribute('href')).toBe('/learn/?course=phase-two')
  expect(screen.getAllByRole('link')).toHaveLength(2)
  expect(open).not.toHaveBeenCalled()
})

it('does not grant a phase when no supported enrollment is returned', async () => {
  api.lookup.mockResolvedValue({ data: [{ course: { code: 'unrelated-course', title: 'Other' } }], error: null })
  const open = vi.fn()
  render(<LearnerEntry onOpenPhaseTwo={open} />)
  expect(await screen.findByRole('heading', { name: 'Your enrollment is not available here' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Contact ACA support' })).toBeTruthy()
  expect(open).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: /Open Phase/ })).toBeNull()
})

it('shows a retry after an enrollment lookup error instead of assuming Phase One', async () => {
  api.lookup.mockResolvedValueOnce({ data: null, error: { message: 'Unavailable' } })
    .mockResolvedValueOnce({ data: [phase(2)], error: null })
  const open = vi.fn()
  render(<LearnerEntry onOpenPhaseTwo={open} />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(open).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
})

it('clears a signed-out account while its earlier enrollment lookup is still pending', async () => {
  let resolve: (value: unknown) => void = () => {}
  api.lookup.mockReturnValue(new Promise(done => { resolve = done }))
  const open = vi.fn()
  render(<LearnerEntry onOpenPhaseTwo={open} />)
  await waitFor(() => expect(api.lookup).toHaveBeenCalled())
  await act(async () => api.onAuth?.('SIGNED_OUT', null))
  expect(await screen.findByLabelText('Enrollment email')).toBeTruthy()
  await act(async () => resolve({ data: [phase(2)], error: null }))
  expect(open).not.toHaveBeenCalled()
})

it('does not let a delayed old getSession result overwrite a newer sign-in', async () => {
  let resolve: (value: unknown) => void = () => {}
  api.getSession.mockReturnValue(new Promise(done => { resolve = done }))
  api.lookup.mockResolvedValue({ data: [phase(2)], error: null })
  const open = vi.fn()
  render(<LearnerEntry onOpenPhaseTwo={open} />)
  await act(async () => api.onAuth?.('SIGNED_IN', session('second-learner')))
  await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
  await act(async () => resolve({ data: { session: null }, error: null }))
  expect(screen.queryByLabelText('Enrollment email')).toBeNull()
  expect(api.eq).toHaveBeenCalledWith('learner_id', 'second-learner')
})

it('uses the existing email sign-in with account creation disabled and a shared return address', async () => {
  api.getSession.mockResolvedValue({ data: { session: null }, error: null })
  render(<LearnerEntry />)
  await userEvent.type(await screen.findByLabelText('Enrollment email'), 'fictional@example.test')
  await userEvent.click(screen.getByRole('button', { name: 'Send my sign-in link' }))
  expect(api.otp).toHaveBeenCalledWith({ email: 'fictional@example.test', options: {
    shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/learn/`,
  } })
  expect(api.lookup).not.toHaveBeenCalled()
  expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Check your email for your secure ACA sign-in link.')
})
