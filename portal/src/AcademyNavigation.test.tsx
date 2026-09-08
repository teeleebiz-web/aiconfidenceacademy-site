import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
vi.mock('react-dom/client', () => ({ createRoot: () => ({ render: vi.fn() }) }))
vi.mock('./components/LessonView', () => ({ LessonView: ({lesson}: any) => <h1>{lesson.title}</h1> }))
vi.mock('./components/JourneyIntroductionView', () => ({ JourneyIntroductionView: ({onContinue}: any) => <button onClick={onContinue}>Continue to Lesson 2.1</button> }))
import { Academy } from '../../academy/main'

it('returns from a lesson to its opening and from the opening to Phase One during review', async () => {
  const lesson = { id: 'l21', page_id: '2.1', title: 'Privacy Before Prompting', journey_id: 'j2', content: {} }
  const intro = { id: 'i2', journey_id: 'j2', media_path: 'approved.mp4', content: { title: 'Journey Two' } }
  const data = { course: { title: 'Phase One' }, journeys: [{id:'j2',journey_number:2,title:'Journey Two'}], lessons: [lesson], introductions: [intro] }
  vi.stubGlobal('fetch', vi.fn(async (path: string) => ({ ok: true, json: async () => path.includes('/welcome/') ? { introduction: intro } : data })))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.history.replaceState(null, '', '/?lesson=2.1')
  const user=userEvent.setup(); render(<Academy />)
  await screen.findByRole('heading', { name: lesson.title })
  await user.click(screen.getByRole('button', { name: '← Journey 2 opening' }))
  await user.click(await screen.findByRole('button', { name: 'Continue to Lesson 2.1' }))
  expect(screen.getByRole('heading', { name: lesson.title })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '← Journey 2 opening' }))
  await screen.findByRole('button', { name: 'Continue to Lesson 2.1' })
  await user.click(screen.getByRole('button', { name: '← Phase One' }))
  expect(screen.getByRole('button', { name: /Watch Journey 2 Welcome Video/ })).toBeTruthy()
  vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/')
})
