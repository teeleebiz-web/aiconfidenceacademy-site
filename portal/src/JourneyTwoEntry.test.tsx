import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

const entry = vi.hoisted(() => ({ element: null as ReactNode }))
vi.mock('react-dom/client', () => ({ createRoot: () => ({ render: (element: ReactNode) => { entry.element = element } }) }))

const lessons = Array.from({ length: 6 }, (_, index) => ({
  id: `lesson-two-${index + 1}`, course_id: 'course', journey_id: 'journey-two',
  page_id: `2.${index + 1}`, title: `Review lesson ${index + 1}`, purpose: 'Synthetic navigation fixture.',
  estimated_minutes: 45, course_position: index + 7, journey_position: index + 1, status: 'draft',
  content: {
    outcomes: [], vocabulary: {}, teaching: ['Approved teaching fixture.'], examples: [],
    practice_prompt: 'Practice fixture.', practice_steps: [], artifact: 'Reflection',
    stay_engaged: 'Continue.', knowledge_check: [], review_questions: [], rhythm: '', accessibility: '',
    video_path: [2, 5].includes(index) ? `video-${index + 1}.mp4` : null,
    audio_path: [1, 3, 4].includes(index) ? `audio-${index + 1}.mp3` : null,
  },
}))
const introduction = {
  id: 'journey-two-introduction', journey_id: 'journey-two', media_kind: 'video',
  media_path: 'opening.mp4', status: 'draft',
  content: {
    presentation: 'single_video', eyebrow: 'Journey Two', title: 'Approved journey opening', lead: 'Welcome.',
    outcomes: [], roadmap: lessons.map(({ page_id, title, purpose }) => ({ page_id, title, purpose })),
    transcript: [{ text: 'Approved opening narration.' }], closing: 'Continue.',
  },
}
const curriculum = {
  course: { title: 'Academy', summary: 'Curriculum' },
  journeys: [{ id: 'journey-two', journey_number: 2, title: 'Journey Two', promise: 'Practice.' }],
  lessons, introductions: [introduction],
}

beforeAll(async () => { document.body.innerHTML = '<div id="root"></div>'; await import('../../academy/main') })
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/academy/phase-one') return { ok: true, json: async () => curriculum }
    if (url === '/api/academy/welcome/journey-two-introduction') return {
      ok: true, json: async () => ({ introduction, mediaUrl: '/signed-opening.mp4', captionUrl: null, companionAudioUrl: null, companionCaptionUrl: null }),
    }
    throw new Error('Unexpected request: ' + url)
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('opens the existing Journey Two video and continues through all six lessons with the assigned media', async () => {
  window.history.replaceState(null, '', '/academy/phase-one/?journey=2')
  const user = userEvent.setup()
  const view = render(entry.element)
  await screen.findByRole('heading', { name: 'Approved journey opening' })
  expect(view.container.querySelector('video source')?.getAttribute('src')).toBe('/signed-opening.mp4')
  await user.click(screen.getByRole('button', { name: 'Continue to Lesson 2.1' }))
  for (let number = 1; number <= 6; number++) {
    expect(screen.getByRole('heading', { level: 1, name: `Review lesson ${number}` })).toBeTruthy()
    expect(window.location.search).toBe(`?lesson=2.${number}`)
    if ([3, 6].includes(number)) {
      const video = screen.getByLabelText(`Lesson 2.${number} video`)
      expect(video.getAttribute('src')).toBe(`/api/academy/lesson-video/lesson-two-${number}?v=video-${number}.mp4`)
      expect(view.container.querySelector('audio')).toBeNull()
    } else if ([2, 4, 5].includes(number)) {
      expect(screen.getByLabelText(`Lesson 2.${number} audio`).getAttribute('src')).toBe(`/api/academy/lesson-audio/lesson-two-${number}?v=audio-${number}.mp3`)
    }
    if (number < 6) await user.click(screen.getByRole('button', { name: `Next lesson 2.${number + 1}: Review lesson ${number + 1}` }))
  }
})

it('reopens lesson 2.6 and its video directly when the current review address is reloaded', async () => {
  window.history.replaceState(null, '', '/academy/phase-one/?lesson=2.6')
  render(entry.element)
  expect(await screen.findByLabelText('Lesson 2.6 video')).toBeTruthy()
  expect(fetch).not.toHaveBeenCalledWith('/api/academy/welcome/journey-two-introduction')
})

it('preserves the general curriculum entry and connects its existing Journey Two welcome button', async () => {
  window.history.replaceState(null, '', '/academy/phase-one/')
  const user = userEvent.setup()
  render(entry.element)
  const welcome = await screen.findByRole('button', { name: /Watch Journey 2 Welcome Video/ })
  expect(screen.getAllByRole('button', { name: /Open lesson/ })).toHaveLength(6)
  await user.click(welcome)
  expect(await screen.findByRole('heading', { name: 'Approved journey opening' })).toBeTruthy()
  expect(window.location.search).toBe('?journey=2')
})
