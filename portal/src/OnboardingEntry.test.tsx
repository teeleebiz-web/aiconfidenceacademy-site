import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { academyWelcomeVideoPath } from '../../academy/AcademyWelcome'
import { onboardingStorageKey } from './components/LearnerOnboarding'

const api = vi.hoisted(() => ({
  rpc: vi.fn(), signMedia: vi.fn(), owner: false, enrollment: true,
  progress: [] as unknown[], mediaError: null as { message: string } | null,
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
      journey_position: 1, unlock_offset_days: 0, status: 'published', content: {} }],
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
        maybeSingle: async () => ({ data: table === 'enrollments' ? (api.enrollment ? enrollment : null)
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
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  api.signMedia.mockReset()
  api.signMedia.mockImplementation(async () => ({ data: api.mediaError ? null : { signedUrl: 'https://media.example.test/founder.mp4' }, error: api.mediaError }))
  api.rpc.mockReset()
  api.rpc.mockImplementation(async (name: string) => {
    if (name === 'is_aca_curriculum_owner') return { data: api.owner, error: null }
    if (name === 'get_learner_lesson_access') return { data: [{ current_lesson_id: 'onboarding-lesson',
      current_journey_id: 'onboarding-journey', access_status: 'available', completed_lessons: 0,
      total_lessons: 1, released_lesson_ids: ['onboarding-lesson'] }], error: null }
    if (name === 'touch_lesson_access') return { data: [{ access_status: 'active', remaining_seconds: 7200 }], error: null }
    throw new Error('Unexpected onboarding RPC')
  })
})

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
  expect(localStorage.getItem(onboardingStorageKey('onboarding-enrollment'))).toBe('complete')
})

it('returns from the ChatGPT guide to the founder welcome', async () => {
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Continue to ChatGPT' }))
  await userEvent.click(screen.getByRole('button', { name: 'Back to Phase One' }))
  expect(screen.getByRole('heading', { name: 'Welcome to the Academy' })).toBeTruthy()
})

it('keeps a returning learner on the learning dashboard after the introduction', async () => {
  localStorage.setItem(onboardingStorageKey('onboarding-enrollment'), 'complete')
  render(<App />)
  expect(await screen.findByRole('button', { name: /open lesson/i })).toBeTruthy()
  expect(api.signMedia).not.toHaveBeenCalled()
})

it('does not repeat the introduction for a learner with saved lesson progress', async () => {
  api.progress = [{ lesson_id: 'onboarding-lesson', status: 'in_progress' }]
  render(<App />)
  expect(await screen.findByRole('button', { name: /open lesson/i })).toBeTruthy()
  expect(api.signMedia).not.toHaveBeenCalled()
})

it('preserves the owner review dashboard', async () => {
  api.owner = true
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Phase One working build' })).toBeTruthy()
  expect(api.signMedia).not.toHaveBeenCalled()
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
  expect(localStorage.getItem(onboardingStorageKey('onboarding-enrollment'))).toBeNull()
  expect(api.rpc.mock.calls.some(([name]) => name === 'touch_lesson_access')).toBe(false)
})
