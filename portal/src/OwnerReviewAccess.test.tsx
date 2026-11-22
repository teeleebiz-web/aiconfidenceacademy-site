import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

const api = vi.hoisted(() => ({ owner: true, ownerError: false, courseMissing: false, firstLesson: false, enrollment: null as any, from: vi.fn(), rpc: vi.fn(), sign: vi.fn() }))
const course = { id: 'review-course', code: 'phase-one-chatgpt-foundations', title: 'Synthetic foundations', summary: 'Review course' }
vi.mock('./lib/supabase', () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'owner' }, access_token: 'fixture' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from: api.from, rpc: api.rpc,
  storage: { from: () => ({ createSignedUrl: api.sign }) },
} }))
vi.mock('./components/LessonView', () => ({ LessonView: ({ lesson, reviewMode }: any) => <h1>{lesson.title} {reviewMode ? 'read only' : 'learner'}</h1> }))
vi.mock('./components/LessonStudySession', () => ({ LessonStudySession: ({ children }: any) => children }))
vi.mock('../../academy/workbook/Workbook', () => ({ Workbook: ({ workbookKey, lessonId }: any) => <h1>{workbookKey} {lessonId} review</h1> }))

beforeEach(() => {
  window.history.replaceState({}, '', '/learn/?review=phase-one&view=curriculum')
  api.owner = true; api.ownerError = false; api.courseMissing = false; api.firstLesson = false; api.enrollment = null
  api.from.mockReset(); api.rpc.mockReset(); api.sign.mockReset()
  api.rpc.mockImplementation(async (name: string) => ({ data: name === 'is_aca_curriculum_owner' && api.owner, error: api.ownerError ? new Error('unavailable') : null }))
  api.sign.mockResolvedValue({ data: { signedUrl: 'https://media.example/signed-fixture' }, error: null })
  api.from.mockImplementation((table: string) => {
    const data = table === 'profiles' ? { first_name: 'Owner' }
      : table === 'enrollments' ? api.enrollment
      : table === 'courses' ? api.courseMissing ? null : course
      : table === 'course_journeys' ? [{ id: 'journey', course_id: course.id, journey_number: 5, title: 'Synthetic journey', status: 'published' }]
      : table === 'lessons' ? [{ id: 'lesson', course_id: course.id, journey_id: 'journey', page_id: api.firstLesson ? '1.1' : '5.4', title: 'Synthetic lesson', estimated_minutes: 60, status: 'published', content: { video_path: 'fixture.mp4' } }]
      : []
    const result = Promise.resolve({ data, error: null })
    const query: any = { select: () => query, eq: () => query, in: () => query, order: () => result, maybeSingle: () => result, then: result.then.bind(result) }
    return query
  })
})

it('opens owner curriculum and signed media without a learner enrollment or learner writes', async () => {
  window.history.replaceState({}, '', '/learn/?course=phase-one')
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Synthetic lesson/ }))
  expect(await screen.findByRole('heading', { name: 'Synthetic lesson read only' })).toBeTruthy()
  expect(api.sign).toHaveBeenCalledWith('fixture.mp4', 7200)
  expect(api.from).not.toHaveBeenCalledWith('lesson_progress')
  expect(api.from).not.toHaveBeenCalledWith('learner_artifacts')
  expect(api.rpc.mock.calls.every(([name]) => name === 'is_aca_curriculum_owner')).toBe(true)
})

it('fails closed if the review course is unavailable', async () => {
  api.courseMissing = true
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The owner curriculum could not load. Please refresh this page.')
  expect(api.from).not.toHaveBeenCalledWith('lessons')
  expect(api.sign).not.toHaveBeenCalled()
})

it('opens the owner workbook without creating or starting an enrollment', async () => {
  window.history.replaceState({}, '', '/learn/?workbook=journey-five&lesson=5.4')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'journey-five 5.4 review' })).toBeTruthy()
  expect(api.rpc.mock.calls.every(([name]) => name === 'is_aca_curriculum_owner')).toBe(true)
})

it.each([false, true])('fails closed when owner authorization is denied or unavailable (error=%s)', async error => {
  api.owner = false; api.ownerError = error
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Your enrollment is not active yet.' })).toBeTruthy()
  expect(api.from).not.toHaveBeenCalledWith('courses')
  expect(api.from).not.toHaveBeenCalledWith('lessons')
  expect(api.sign).not.toHaveBeenCalled()
})

it('keeps an explicitly requested owner review separate from a staged learner start', async () => {
  api.enrollment = { id: 'staged', learner_id: 'owner', course_id: course.id, course, status: 'pending', learner_start_pending: true }
  render(<App />)
  expect(await screen.findByRole('button', { name: /Synthetic lesson/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Begin Phase One' })).toBeNull()
  expect(api.rpc.mock.calls.every(([name]) => name === 'is_aca_curriculum_owner')).toBe(true)
})

it('preserves the ordinary learner staged-start screen', async () => {
  api.owner = false
  api.enrollment = { id: 'staged', learner_id: 'owner', course_id: course.id, course, status: 'pending', learner_start_pending: true }
  window.history.replaceState({}, '', '/learn/?course=phase-one')
  render(<App />)
  expect(await screen.findByRole('button', { name: 'Begin Phase One' })).toBeTruthy()
  expect(api.from).not.toHaveBeenCalledWith('courses')
  expect(api.from).not.toHaveBeenCalledWith('lessons')
})

it.each([false, true])('reviews the real welcome and orientation through Lesson 1.1 without learner writes (staged enrollment=%s)', async staged => {
  api.firstLesson = true
  if (staged) api.enrollment = { id: 'staged', learner_id: 'owner', course_id: course.id, course, status: 'pending', learner_start_pending: true }
  window.history.replaceState({}, '', '/learn/?review=phase-one&view=welcome')
  const user = userEvent.setup()
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Welcome to the Academy' })).toBeTruthy()
  expect(api.sign).toHaveBeenCalledWith('academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4', 3600)
  await user.click(screen.getByRole('button', { name: 'Continue to ChatGPT' }))
  expect(await screen.findByRole('heading', { name: 'Getting Started with ChatGPT' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Continue to Lesson 1.1' }))
  expect(await screen.findByRole('heading', { name: 'Synthetic lesson read only' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Control Center' }).getAttribute('href')).toBe('/control-center/')
  expect(api.from).not.toHaveBeenCalledWith('lesson_progress')
  expect(api.from).not.toHaveBeenCalledWith('learner_artifacts')
  expect(api.rpc.mock.calls.every(([name]) => name === 'is_aca_curriculum_owner')).toBe(true)
})

it('does not grant welcome review to an account without owner or enrollment access', async () => {
  api.owner = false
  window.history.replaceState({}, '', '/learn/?review=phase-one&view=welcome')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Your enrollment is not active yet.' })).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: 'Owner curriculum navigation' })).toBeNull()
  expect(api.sign).not.toHaveBeenCalled()
})
