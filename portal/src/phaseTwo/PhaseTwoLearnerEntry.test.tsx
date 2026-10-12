import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoLearnerEntry } from './PhaseTwoLearnerEntry'

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  from: vi.fn(),
  courseResult: vi.fn(),
  enrollmentResult: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: api.getSession,
      onAuthStateChange: api.onAuthStateChange,
      signInWithOtp: api.signInWithOtp,
      signInWithPassword: api.signInWithPassword,
    },
    from: api.from,
  },
}))
vi.mock('../components/SignIn', () => ({
  SignIn: ({ onRequestLink }: { onRequestLink: (email:string)=>Promise<void> }) => (
    <section>
      <h1>Protected course sign-in</h1>
      <button onClick={() => { void onRequestLink('reviewer@example.org') }}>Send test link</button>
    </section>
  ),
}))
vi.mock('./PhaseTwoLearnerHome', () => ({
  PhaseTwoLearnerHome: ({ enrollmentId }: { enrollmentId: string }) => (
    <section><h1>Phase Two learner home</h1><p>Enrollment {enrollmentId}</p></section>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.getSession.mockResolvedValue({ data: { session: { user: { id: 'learner-a' } } } })
  api.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe() {} } } })
  api.signInWithOtp.mockResolvedValue({ error: null })
  api.signInWithPassword.mockResolvedValue({ error: null })
  api.courseResult.mockResolvedValue({ data: null, error: null })
  api.enrollmentResult.mockResolvedValue({ data: null, error: null })
  api.from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: () => table === 'courses' ? api.courseResult() : api.enrollmentResult(),
    }
    return query
  })
})

describe('isolated Phase Two enrollment entry', () => {
  it('requires authentication before looking up a course or enrollment', async () => {
    api.getSession.mockResolvedValue({ data: { session: null } })
    render(<PhaseTwoLearnerEntry />)
    expect(await screen.findByRole('heading', { name: 'Protected course sign-in' })).toBeTruthy()
    expect(api.from).not.toHaveBeenCalled()
  })

  it('preserves the Phase Two return route for passwordless sign-in', async () => {
    api.getSession.mockResolvedValue({ data: { session: null } })
    const user = userEvent.setup()
    render(<PhaseTwoLearnerEntry />)
    await user.click(await screen.findByRole('button', { name: 'Send test link' }))
    expect(api.signInWithOtp).toHaveBeenCalledWith({
      email: 'reviewer@example.org',
      options: expect.objectContaining({
        shouldCreateUser: false,
        emailRedirectTo: expect.stringContaining('/learn/?course=phase-two'),
      }),
    })
  })

  it('keeps a draft course closed and never probes enrollments', async () => {
    render(<PhaseTwoLearnerEntry />)
    expect(await screen.findByText(/enrollment and learning access are not yet open/i)).toBeTruthy()
    expect(api.from).toHaveBeenCalledWith('courses')
    expect(api.from).not.toHaveBeenCalledWith('enrollments')
    expect(screen.queryByRole('heading', { name: 'Phase Two learner home' })).toBeNull()
  })

  it('requires a matching active enrollment even after publication', async () => {
    api.courseResult.mockResolvedValue({ data: { id: 'phase-two-course', status: 'published' }, error: null })
    render(<PhaseTwoLearnerEntry />)
    expect(await screen.findByText(/No active Phase Two enrollment/i)).toBeTruthy()
    expect(api.from).toHaveBeenCalledWith('enrollments')
    expect(screen.queryByRole('heading', { name: 'Phase Two learner home' })).toBeNull()
  })

  it('blocks mismatched or expired enrollments', async () => {
    api.courseResult.mockResolvedValue({ data: { id: 'phase-two-course', status: 'published' }, error: null })
    api.enrollmentResult.mockResolvedValue({
      data: {
        id: 'wrong-enrollment', status: 'active', learner_id: 'learner-b',
        course_id: 'phase-two-course',
        starts_at: null,
        access_expires_at: null,
      }, error: null,
    })
    const view = render(<PhaseTwoLearnerEntry />)
    expect(await screen.findByText(/No active Phase Two enrollment/i)).toBeTruthy()
    view.unmount()
    api.enrollmentResult.mockResolvedValue({
      data: {
        id: 'expired-enrollment', status: 'active', learner_id: 'learner-a',
        course_id: 'phase-two-course', starts_at: null,
        access_expires_at: '2020-01-01T00:00:00Z',
      }, error: null,
    })
    render(<PhaseTwoLearnerEntry />)
    expect(await screen.findByText(/No active Phase Two enrollment/i)).toBeTruthy()
  })

  it('connects the learner home only for an active, course-matched enrollment', async () => {
    api.courseResult.mockResolvedValue({ data: { id: 'phase-two-course', status: 'published' }, error: null })
    api.enrollmentResult.mockResolvedValue({
      data: {
        id: 'enrollment-verified', status: 'active', learner_id: 'learner-a',
        course_id: 'phase-two-course',
        starts_at: '2026-01-01T00:00:00Z', access_expires_at: null,
      }, error: null,
    })
    render(<PhaseTwoLearnerEntry />)
    expect(await screen.findByRole('heading', { name: 'Phase Two learner home' })).toBeTruthy()
    expect(screen.getByText('Enrollment enrollment-verified')).toBeTruthy()
  })
})
