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
  PhaseTwoLessonExperience: ({ pageId, lessonTitle, medium, introAudio, onOpenWorkbook }: {
    pageId: string; lessonTitle: string; medium: string
    introAudio?: { url: string }; onOpenWorkbook?: () => void
  }) => (
    <main>
      <h1>{lessonTitle}</h1>
      <p>{'Lesson ' + pageId}</p>
      <p>{medium === 'audio' ? 'Audio placeholder' : 'Video placeholder'}</p>
      {introAudio?.url && <p>Approved audio attached</p>}
      {onOpenWorkbook && <button onClick={onOpenWorkbook}>Open Workbook — Lesson {pageId}</button>}
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
  window.history.replaceState({}, '', '/learn/?review=phase-two')
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

  it('never plays an unapproved draft narrator recording in the protected lesson', async () => {
    const content = lessons[0].content as typeof lessons[0]['content'] & {
      phase_two_media_plan?: {
        audio_lesson?: { generated_introduction?: {
          url: string; transcript: string; review_status: string; voice_id?: string
        } }
      }
    }
    content.phase_two_media_plan = { audio_lesson: { generated_introduction: {
      url: 'https://example.org/earlier-narration.wav',
      transcript: 'Draft narration.',
      review_status: 'generated_audio_for_review_not_final_voice_approved',
    } } }
    try {
      render(<PhaseTwoReview />)
      expect(await screen.findByRole('heading', { name: 'Synthetic lesson 1.1' })).toBeTruthy()
      expect(screen.queryByText('Approved audio attached')).toBeNull()
    } finally {
      delete content.phase_two_media_plan
    }
  })

  it('opens a completed second lesson directly without unlocking other unfinished lessons', async () => {
    const content = lessons[1].content as typeof lessons[1]['content'] & {
      phase_two_production?: { approval_status: string }
    }
    content.phase_two_production = { approval_status: 'founder_review_not_published' }
    window.history.replaceState({}, '', '/learn/?review=phase-two&lesson=1.2')
    try {
      render(<PhaseTwoReview />)
      expect(await screen.findByRole('heading', { name: 'Synthetic lesson 1.2' })).toBeTruthy()
      expect(screen.getByText('Lesson 1.2')).toBeTruthy()
      expect(api.rpc).toHaveBeenCalledWith('is_aca_curriculum_owner')
    } finally {
      delete content.phase_two_production
    }
  })

  it('keeps an unfinished lesson hidden behind the first complete learning experience', async () => {
    window.history.replaceState({}, '', '/learn/?review=phase-two&lesson=4.6')
    render(<PhaseTwoReview />)
    expect(await screen.findByRole('heading', { name: 'Synthetic lesson 1.1' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Synthetic lesson 4.6' })).toBeNull()
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
  it('returns to Lesson 1.2 after secure email-link sign-in', async () => {
    api.getSession.mockResolvedValue({ data: { session: null } })
    window.history.replaceState({}, '', '/learn/?review=phase-two&lesson=1.2')
    const user = userEvent.setup()
    render(<PhaseTwoReview />)
    await screen.findByRole('heading', { name: 'Sign in to Phase Two' })
    await user.type(screen.getByLabelText('Academy email'), 'reviewer@example.org')
    await user.click(screen.getByRole('button', { name: 'Use a one-time email link instead' }))
    await user.click(screen.getByRole('button', { name: 'Send secure sign-in link' }))
    expect(api.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        shouldCreateUser: false,
        emailRedirectTo: expect.stringContaining('/learn/?review=phase-two&lesson=1.2'),
      }),
    }))
  })

  it.each(lessons.map(item => item.page_id))('connects each produced lesson %s to its real workbook page and back', async (pageId) => {
    const item = lessons.find(row => row.page_id === pageId)!
    const content = item.content as typeof item.content & { phase_two_production?: { approval_status: string } }
    content.phase_two_production = { approval_status: 'founder_review_not_published' }
    window.history.replaceState({}, '', '/learn/?review=phase-two&lesson=' + pageId)
    const [journey, number] = pageId.split('.').map(Number)
    api.rpc.mockImplementation(async (name: string) => ({
      error: null,
      data: name === 'is_aca_curriculum_owner' ? true : {
        allowedPages: [number], last_page: number, revision: 0, scope: 'owner-review',
        answers: { ['test-' + pageId]: 'Retained workbook notes' },
        workbook: { key: 'journey-' + journey, version: 1, title: 'Journey ' + journey + ' Workbook',
          pages: [{ number, lesson_id: pageId, title: 'Workbook ' + pageId,
            blocks: [{ type: 'field', id: 'test-' + pageId, label: 'Workbook notes', lines: 3 }] }] },
      },
    }))
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    try {
      render(<PhaseTwoReview />)
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Open Workbook — Lesson ' + pageId }))
      expect(await screen.findByRole('heading', { name: 'Workbook ' + pageId })).toBeTruthy()
      expect(screen.getByLabelText('Workbook notes')).toHaveProperty('value', 'Retained workbook notes')
      expect(api.rpc).toHaveBeenCalledWith('get_aca_phase_two_workbook', { p_enrollment_id: null, p_journey: journey })
      await userEvent.setup().click(screen.getByRole('button', { name: 'Print / Save PDF' }))
      expect(print).toHaveBeenCalledOnce()
      await userEvent.setup().click(screen.getByRole('button', { name: new RegExp('Back to Lesson ' + pageId) }))
      expect(await screen.findByRole('heading', { name: item.title })).toBeTruthy()
    } finally { delete content.phase_two_production; print.mockRestore() }
  })

  it.each(['3.2', '3.3'])('keeps Lesson %s selected after email-link sign-in', async pageId => {
    api.getSession.mockResolvedValue({ data: { session: null } })
    window.history.replaceState({}, '', '/learn/?review=phase-two&lesson=' + pageId)
    const user = userEvent.setup()
    render(<PhaseTwoReview />)
    await screen.findByRole('heading', { name: 'Sign in to Phase Two' })
    await user.type(screen.getByLabelText('Academy email'), 'reviewer@example.org')
    await user.click(screen.getByRole('button', { name: 'Use a one-time email link instead' }))
    await user.click(screen.getByRole('button', { name: 'Send secure sign-in link' }))
    expect(api.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ emailRedirectTo: window.location.origin + '/learn/?review=phase-two&lesson=' + pageId }),
    }))
  })

})
