import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

const entry = vi.hoisted(() => ({ element: null as ReactNode }))
vi.mock('react-dom/client', () => ({ createRoot: () => ({ render: (element: ReactNode) => { entry.element = element } }) }))
const lessons = Array.from({ length: 36 }, (_, i) => ({
  id: `lesson-${i}`, course_id: 'course', journey_id: `journey-${Math.floor(i / 6) + 1}`,
  page_id: `${Math.floor(i / 6) + 1}.${i % 6 + 1}`, title: `Navigation fixture ${i + 1}`,
  purpose: 'Navigation check', estimated_minutes: 45, course_position: i + 1, journey_position: i % 6 + 1, status: 'published',
  content: { outcomes: [], vocabulary: {}, teaching: [], examples: [], practice_prompt: 'Practice', practice_steps: [], artifact: 'Reflection', stay_engaged: 'Continue', knowledge_check: [], review_questions: [], rhythm: '', accessibility: '' },
}))
const curriculum = { course: { title: 'Academy', summary: 'Curriculum' }, journeys: Array.from({ length: 6 }, (_, i) => ({ id: `journey-${i + 1}`, journey_number: i + 1, title: `Journey ${i + 1}`, promise: 'Practice' })), lessons, introductions: [] }

beforeAll(async () => { document.body.innerHTML = '<div id="root"></div>'; await import('../../academy/main') })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('opens every curriculum lesson and every next-lesson / next-journey destination at the new page start', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => curriculum })))
  const scroll = vi.fn()
  vi.stubGlobal('scrollTo', scroll)
  const user = userEvent.setup()
  window.history.replaceState(null, '', '/academy/phase-one/?view=curriculum')
  render(entry.element)
  await user.click((await screen.findByText('Navigation fixture 1')).closest('button')!)
  for (let i = 0; i < lessons.length; i++) {
    const heading = await screen.findByRole('heading', { level: 1, name: lessons[i].title })
    expect(document.activeElement).toBe(heading)
    expect(scroll).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
    expect(window.location.search).toBe(`?lesson=${lessons[i].page_id}`)
    if (i < lessons.length - 1) {
      scroll.mockClear()
      await user.click(screen.getByRole('button', { name: new RegExp(`^Next (lesson|Journey, lesson) ${lessons[i + 1].page_id}:`) }))
      expect(scroll).toHaveBeenCalledOnce()
    }
  }
  cleanup()
  for (const lesson of lessons) {
    window.history.replaceState(null, '', '/academy/phase-one/?view=curriculum')
    render(entry.element)
    await user.click((await screen.findByText(lesson.title)).closest('button')!)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: lesson.title }))
    cleanup()
  }
}, 30000)
