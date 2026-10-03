import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { academyWelcomeVideoPath } from '../../academy/AcademyWelcome'

const api = vi.hoisted(() => ({
  rpc: vi.fn(), signMedia: vi.fn(), owner: false, enrollment: true,
  progress: [] as unknown[], mediaError: null as { message: string } | null,
  completedAt: null as string | null, completionError: false, accessStatus: 'active', lessonMediaError: false,
}))

vi.mock('./lib/supabase', () => {
  const enrollment = {
    id: 'onboarding-enrollment', learner_id: 'onboarding-learner', course_id: 'onboarding-course',
    status: 'active', starts_at: null, access_expires_at: null,
    course: { id: 'onboarding-course', code: 'phase-one-chatgpt-foundations', title: 'ACA Phase One', summary: '' },
  }
  const rows: Record<string, unknown[]> = {
    course_journeys: [{ id: 'onboarding-journey', course_id: 'onboarding-course', journey_number: 1,
      week_number: 1, title: 'First Journey', promise: '', release_offset_days: 0, status: 'published' }],
    lessons: [{ id: 'onboarding-lesson', course_id: 'onboarding-course', journey_id: 'onboarding-journey',
      page_id: '1.1', title: 'First Lesson', purpose: '', estimated_minutes: 45, course_position: 1,
      journey_position: 1, unlock_offset_days: 0, status: 'published', content: { video_path: 'approved-lesson-1.1.mp4' } }],
    journey_introductions: [], learner_artifacts: [],
  }
  return { supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'onboarding-learner' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    rpc: api.rpc,
    storage: { from: (bucket: string) => ({ createSignedUrl: (path: string, seconds: number) => api.signMedia(bucket, path, seconds) }) },
    from: (table: string) => {
      const result = Promise.resolve({ data: table === 'lesson_progress' ? api.progress : rows[table] ?? [], error: null })
      const query = {
        select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
        maybeSingle: async () => ({ data: table === 'enrollments' ? (api.enrollment ? { ...enrollment, onboarding_completed_at: api.completedAt } : null)
          : table === 'profiles' ? { first_name: 'Learner' } : null, error: null }),
        then: result.then.bind(result),
      }
      return query
    },
  } }
})

vi.mock('./components/LessonView', () => ({
  LessonView: ({ lesson }: { lesson: { page_id: string } }) => <h1>Lesson {lesson.page_id}</h1>,
}))

beforeEach(() => {
  localStorage.clear()
  api.owner = false; api.enrollment = true; api.progress = []; api.mediaError = null
  api.completedAt = null; api.completionError = false; api.accessStatus = 'active'; api.lessonMediaError = false
  window.history.replaceState(null, '', '/learn/')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  api.signMedia.mockReset()
  api.signMedia.mockImplementation(async (_bucket: string, path: string) => {
    const error = api.mediaError ?? (api.lessonMediaError && path === 'approved-lesson-1.1.mp4' ? { message: 'Unavailable' } : null)
    return { data: error ? null : { signedUrl: 'https://media.example.test/founder.mp4' }, error }
  })
  api.rpc.mockReset()
  api.rpc.mockImplementation(async (name: string) => {
    if (name === 'is_aca_curriculum_owner') return { data: api.owner, error: null }
    if (name === 'get_learner_lesson_access') return { data: [{ current_lesson_id: 'onboarding-lesson',
      current_journey_id: 'onboarding-journey', access_status: 'available', completed_lessons: 0,
      total_lessons: 1, released_lesson_ids: ['onboarding-lesson'] }], error: null }
    if (name === 'touch_lesson_access') return { data: [{ access_status: api.accessStatus, remaining_seconds: 7200 }], error: null }
    if (name === 'complete_aca_onboarding') return { data: api.completionError ? null : '2026-10-03T16:00:00Z', error: api.completionError ? { message: 'Unavailable' } : null }
    throw new Error('Unexpected onboarding RPC')
  })
})

afterEach(() => { vi.restoreAllMocks() })

it('opens the exact founder film, then the existing ChatGPT guide, then Lesson 1.1', async () => {
  const user = userEvent.setup()
  const { container } = render(<App />)
  expect(await screen.findByRole('heading', { name: 'Welcome to the Academy' })).toBeTruthy()
  expect(api.signMedia).toHaveBeenCalledWith('aca-learning-media', academyWelcomeVideoPath, 3600)
  expect(container.querySelector('video')?.getAttribute('src')).toBe('https://media.example.test/founder.mp4')
  expect(screen.queryByRole('button', { name: /open lesson/i })).toBeNull()
  expect(api.rpc.mock.calls.some(([name]) => name === 'touch_lesson_access')).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Continue to ChatGPT' }))
  expect(screen.getByRole('heading', { name: 'Getting Started with ChatGPT' })).toBeTruthy()
  expect(screen.getByLabelText('Getting Started with ChatGPT: computer walkthrough')).toBeTruthy()
  await user.click(screen.getByRole('radio', { name: /^iPhone$/ }))
  expect(screen.getByRole('link', { name: 'Open ChatGPT in the App Store' }).getAttribute('href')).toContain('id6448311069')
  expect(api.rpc.mock.calls.some(([name]) => name === 'touch_lesson_access')).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Continue to Lesson 1.1' }))
  expect(await screen.findByRole('heading', { name: 'Lesson 1.1' })).toBeTruthy()
  expect(api.rpc).toHaveBeenCalledWith('touch_lesson_access', { p_enrollment_id: 'onboarding-enrollment', p_lesson_id: 'onboarding-lesson' })
  expect(api.rpc).toHaveBeenCalledWith('complete_aca_onboarding', { p_enrollment_id: 'onboarding-enrollment' })
  const calls = api.rpc.mock.calls.map(([name]) => name)
  expect(calls.indexOf('touch_lesson_access')).toBeLessThan(calls.indexOf('complete_aca_onboarding'))
})

it('returns from the ChatGPT guide to the founder welcome', async () => {
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Continue to ChatGPT' }))
  await userEvent.click(screen.getByRole('button', { name: 'Back to Phase One' }))
  expect(screen.getByRole('heading', { name: 'Welcome to the Academy' })).toBeTruthy()
})

it('keeps a returning learner on the learning dashboard after the introduction', async () => {
  api.completedAt = '2026-10-03T16:00:00Z'
  render(<App />)
  expect(await screen.findByRole('button', { name: /open lesson/i })).toBeTruthy()
  expect(api.signMedia).not.toHaveBeenCalled()
})

it('lets the learner continue when device storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage disabled') })
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Continue to ChatGPT' }))
  await userEvent.click(screen.getByRole('button', { name: 'Continue to Lesson 1.1' }))
  expect(await screen.findByRole('heading', { name: 'Lesson 1.1' })).toBeTruthy()
})

it('does not treat unfinished lesson progress as completing the introduction', async () => {
  api.progress = [{ lesson_id: 'onboarding-lesson', status: 'in_progress' }]
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Welcome to the Academy' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /open lesson/i })).toBeNull()
})

it('preserves the returning owner review dashboard after the opening sequence', async () => {
  api.owner = true
  api.completedAt = '2026-10-03T16:00:00Z'
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Phase One working build' })).toBeTruthy()
  expect(api.signMedia).not.toHaveBeenCalled()
})

it('opens the same welcome and ChatGPT guide for the owner without starting a learner clock', async () => {
  api.owner = true
  api.progress = [{ lesson_id: 'onboarding-lesson', status: 'in_progress' }]
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Welcome to the Academy' })).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Continue to ChatGPT' }))
  expect(screen.getByRole('heading', { name: 'Getting Started with ChatGPT' })).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Continue to Lesson 1.1' }))
  expect(await screen.findByRole('heading', { name: 'Lesson 1.1' })).toBeTruthy()
  expect(api.rpc).toHaveBeenCalledWith('complete_aca_onboarding', { p_enrollment_id: 'onboarding-enrollment' })
  expect(api.rpc.mock.calls.some(([name]) => name === 'touch_lesson_access')).toBe(false)
  expect(api.rpc.mock.calls.some(([name]) => name === 'get_learner_lesson_access')).toBe(false)
})

it('does not request protected founder media without an enrollment', async () => {
  api.enrollment = false
  render(<App />)
  expect(await screen.findByText('Your enrollment is not active yet.')).toBeTruthy()
  expect(api.signMedia).not.toHaveBeenCalled()
})

it('reports a failed media request without opening a lesson or marking onboarding complete', async () => {
  api.mediaError = { message: 'Denied' }
  render(<App />)
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(screen.queryByRole('button', { name: 'Continue to ChatGPT' })).toBeNull()
  expect(api.rpc.mock.calls.some(([name]) => name === 'complete_aca_onboarding')).toBe(false)
  expect(api.rpc.mock.calls.some(([name]) => name === 'touch_lesson_access')).toBe(false)
})


it('keeps the ChatGPT guide open if lesson access is unavailable', async () => {
  api.accessStatus = 'scheduled'
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Continue to ChatGPT' }))
  await userEvent.click(screen.getByRole('button', { name: 'Continue to Lesson 1.1' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Getting Started with ChatGPT' })).toBeTruthy()
  expect(api.rpc.mock.calls.some(([name]) => name === 'complete_aca_onboarding')).toBe(false)
})

it('keeps the introduction open and lets the learner retry a failed completion save', async () => {
  api.completionError = true
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Continue to ChatGPT' }))
  await userEvent.click(screen.getByRole('button', { name: 'Continue to Lesson 1.1' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Your introduction could not be saved. Please try again.')
  expect(screen.getByRole('heading', { name: 'Getting Started with ChatGPT' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Lesson 1.1' })).toBeNull()
  api.completionError = false
  await userEvent.click(screen.getByRole('button', { name: 'Continue to Lesson 1.1' }))
  expect(await screen.findByRole('heading', { name: 'Lesson 1.1' })).toBeTruthy()
})

it('does not bypass the first introduction through a workbook link', async () => {
  window.history.replaceState(null, '', '/learn/?workbook=journey-one&lesson=1.1')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Welcome to the Academy' })).toBeTruthy()
})


it('does not complete onboarding if the first lesson recording cannot load', async () => {
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Continue to ChatGPT' }))
  api.lessonMediaError = true
  await userEvent.click(screen.getByRole('button', { name: 'Continue to Lesson 1.1' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Getting Started with ChatGPT' })).toBeTruthy()
  expect(api.rpc.mock.calls.some(([name]) => name === 'complete_aca_onboarding')).toBe(false)
  expect(screen.queryByRole('heading', { name: 'Lesson 1.1' })).toBeNull()
})
