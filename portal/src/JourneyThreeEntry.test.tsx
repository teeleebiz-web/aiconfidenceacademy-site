import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

const entry = vi.hoisted(() => ({ element: null as ReactNode }))
vi.mock('react-dom/client', () => ({ createRoot: () => ({ render: (element: ReactNode) => { entry.element = element } }) }))

const lesson = {
  id: 'lesson-three-one', course_id: 'course', journey_id: 'journey-three',
  page_id: '3.1', title: 'Opening lesson', purpose: 'Synthetic navigation fixture.',
  estimated_minutes: 45, course_position: 13, journey_position: 1, status: 'published',
  content: {
    outcomes: [], vocabulary: {}, teaching: ['Approved teaching fixture.'], examples: [],
    practice_prompt: 'Practice fixture.', practice_steps: [], artifact: 'Reflection',
    stay_engaged: 'Continue.', knowledge_check: [], review_questions: [], rhythm: '', accessibility: '',
    video_path: 'approved-opening.mp4',
  },
}
const obsoleteIntroduction = {
  id: 'obsolete-welcome', journey_id: 'journey-three', media_kind: 'video', media_path: 'approved-opening.mp4',
  content: { title: 'Duplicate opening' },
}
const curriculum = {
  course: { title: 'Academy', summary: 'Curriculum' },
  journeys: [{ id: 'journey-three', journey_number: 3, title: 'Journey Three', promise: 'Practice.' }],
  lessons: [lesson], introductions: [] as typeof obsoleteIntroduction[],
}

beforeAll(async () => { document.body.innerHTML = '<div id="root"></div>'; await import('../../academy/main') })
beforeEach(() => {
  curriculum.introductions = []
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/academy/phase-one') return { ok: true, json: async () => curriculum }
    throw new Error('Unexpected request: ' + url)
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('opens the approved 3.1 video from the old welcome address after the duplicate is removed', async () => {
  window.history.replaceState(null, '', '/academy/phase-one/?journey=3')
  const view = render(entry.element)
  const video = await screen.findByLabelText('Lesson 3.1 video')
  expect(video.getAttribute('src')).toBe('/api/academy/lesson-video/lesson-three-one?v=approved-opening.mp4')
  expect(window.location.search).toBe('?lesson=3.1')
  expect(view.container.querySelectorAll('video')).toHaveLength(1)
  expect(screen.queryByText('Read the journey introduction')).toBeNull()
  expect(screen.getByRole('link', { name: 'Open Workbook' }).closest('#lesson-practice')).toBeTruthy()
  expect(fetch).toHaveBeenCalledWith('/api/academy/phase-one', { cache: 'no-store' })
})

it('offers one lesson entry even if an obsolete welcome is returned, and opens the approved video', async () => {
  curriculum.introductions = [obsoleteIntroduction]
  window.history.replaceState(null, '', '/academy/phase-one/')
  const user = userEvent.setup()
  render(entry.element)
  const lessonButton = await screen.findByRole('button', { name: /Opening lesson.*Open lesson/ })
  expect(screen.queryByRole('button', { name: /Watch Journey 3 Welcome Video/ })).toBeNull()
  await user.click(lessonButton)
  expect(await screen.findByLabelText('Lesson 3.1 video')).toBeTruthy()
  expect(window.location.search).toBe('?lesson=3.1')
  expect(screen.getByText('Approved teaching fixture.')).toBeTruthy()
})
