import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoReview } from './PhaseTwoReview'

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: api.getSession,
      onAuthStateChange: api.onAuthStateChange,
      signInWithPassword: api.signInWithPassword,
      signInWithOtp: api.signInWithOtp,
    },
    rpc: api.rpc,
    from: api.from,
  },
}))

vi.mock('../phaseTwo/PhaseTwoLessonExperience', () => ({
  PhaseTwoLessonExperience: ({ pageId, lessonTitle, medium }: {
    pageId: string; lessonTitle: string; medium: string
  }) => (
    <main>
      <h1>{lessonTitle}</h1>
      <p>{'Lesson ' + pageId}</p>
      <p>{medium === 'audio' ? 'Audio placeholder' : 'Video placeholder'}</p>
    </main>
  ),
}))

const journeys = Array.from({ length: 6 }, (_, i) => ({
  id: 'journey-' + (i + 1),
  journey_number: i + 1,
  title: 'Synthetic Journey ' + (i + 1),
  promise: 'This journey has an approved teaching destination.',
  status: 'draft',
}))
const lessons = Array.from({ length: 36 }, (_, i) => {
  const journey = Math.floor(i / 6) + 1
  const lesson = i % 6 + 1
  return {
    id: 'lesson-' + (i + 1),
    journey_id: 'journey-' + journey,
    page_id: journey + '.' + lesson,
    title: 'Synthetic lesson ' + (journey + '.' + lesson),
    purpose: 'Complete an applied task using a continuing project.',
    course_position: i + 1,
    journey_position: lesson,
    status: 'draft',
    content: {
      planned_media: lesson <= 3 ? 'video' : 'audio',
      media_assignment_status: 'provisional_founder_review',
      phase_two: {
        teaching: 'Synthetic teaching.',
        worked_case: 'Synthetic worked case.',
        apply_to_project: 'Synthetic application.',
        ai_request: 'Synthetic AI request.',
        verify_and_save: 'Synthetic verification.',
        applied_completion_check: 'Synthetic completion criterion.',
        journey: {
          prerequisite: 'Previous project evidence.',
          journey_result: 'One complete journey artifact.',
          independent_application: 'Two independent hours.',
          evidence_review: 'Record a meaningful correction.',
        },
      },
    },
  }
})

function configureTables() {
  api.from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: table === 'courses'
          ? { id: 'phase-two-draft', code: 'phase-two-ai-professional-builder', status: 'draft' }
          : null,
        error: null,
      }),
      order: async () => ({
        data: table === 'course_journeys' ? journeys : table === 'lessons' ? lessons : [],
        error: null,
      }),
    }
    return query
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  api.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe() {} } } })
  api.getSession.mockResolvedValue({ data: { session: { user: { id: 'authorized-reviewer' } } } })
  api.rpc.mockResolvedValue({ data: true, error: null })
  api.signInWithPassword.mockResolvedValue({ error: null })
  api.signInWithOtp.mockResolvedValue({ error: null })
  configureTables()
})

describe('unpublished Phase Two founder review', () => {
  it('requires sign-in and does not fetch protected curriculum for signed-out visitors', async () => {
    api.getSession.mockResolvedValue({ data: { session: null } })
    render(<PhaseTwoReview />)
    expect(await screen.findByRole('heading', { name: 'Sign in to Phase Two' })).toBeTruthy()
    expect(api.from).not.toHaveBeenCalled()
  })

  it('blocks curriculum queries when the Academy owner check is denied', async () => {
    api.rpc.mockResolvedValue({ data: false, error: null })
    render(<PhaseTwoReview />)
    expect(await screen.findByRole('heading', { name: 'Access is not available' })).toBeTruthy()
    expect(api.from).not.toHaveBeenCalled()
  })

  it('opens the first learner lesson without development labels or a course inventory', async () => {
    render(<PhaseTwoReview />)
    expect(await screen.findByRole('heading', { name: 'Synthetic lesson 1.1' })).toBeTruthy()
    expect(screen.getByText('Lesson 1.1')).toBeTruthy()
    expect(screen.getByText('Video placeholder')).toBeTruthy()
    expect(screen.queryByText(/Founder review|Unpublished working build|36 lessons|18 video slots/i)).toBeNull()
    expect(api.rpc).toHaveBeenCalledWith('is_aca_curriculum_owner')
    expect(api.rpc).toHaveBeenCalledTimes(1)
  })

  it('preserves the review query parameter in owner email sign-in links', async () => {
    api.getSession.mockResolvedValue({ data: { session: null } })
    const user = userEvent.setup()
    render(<PhaseTwoReview />)
    await screen.findByRole('heading', { name: 'Sign in to Phase Two' })
    await user.type(screen.getByLabelText('Academy email'), 'reviewer@example.org')
    await user.click(screen.getByRole('button', { name: 'Use a one-time email link instead' }))
    await user.click(screen.getByRole('button', { name: 'Send secure sign-in link' }))
    expect(api.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'reviewer@example.org',
      options: expect.objectContaining({
        shouldCreateUser: false,
        emailRedirectTo: expect.stringContaining('/learn/?review=phase-two'),
      }),
    }))
  })
})
