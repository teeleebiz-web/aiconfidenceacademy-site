import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LessonStudySession } from './LessonStudySession'
import type { StudySession } from '../lib/lessonStudy'

const api = vi.hoisted(() => ({ request: vi.fn(), exit: vi.fn() }))
vi.mock('../lib/lessonStudy', () => ({ requestStudySession: api.request, pauseStudyOnExit: api.exit }))

let used: number, seen: number, running: boolean, token: number
const reply = (): StudySession => ({ access_status: used >= 7200000 ? 'expired' : 'active',
  study_state: used >= 7200000 ? 'ended' : running ? 'running' : 'paused', active_seconds: used / 1000,
  remaining_seconds: Math.max(0, Math.ceil((7200000 - used) / 1000)), study_token: String(token), limit_at: null, study_mode: 'budget' })
const settle = () => { const gap = Date.now() - seen; if (running && gap <= 45000) used += gap; seen = Date.now() }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-31T12:00:00Z'))
  used = 0; seen = Date.now(); running = false; token = 0
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  api.request.mockReset().mockImplementation(async (_e, _l, action) => {
    settle(); if (action === 'start') { running = true; token++ } else if (action === 'pause') running = false
    return reply()
  })
  api.exit.mockReset().mockImplementation(() => { settle(); running = false })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

const open = async (closed = vi.fn()) => {
  let result!: ReturnType<typeof render>
  await act(async () => { result = render(<LessonStudySession enrollmentId="enrollment" lessonId="lesson" onClosed={closed}>
    <label>Draft answer<input aria-label="Draft answer" /></label><video />
  </LessonStudySession>) })
  return result
}
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const click = async (label: string) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: label })) }) }

it('preserves 90 minutes and an unsaved draft after 30 minutes of study and an hour away', async () => {
  await open()
  const input = screen.getByRole('textbox', { name: 'Draft answer' }) as HTMLInputElement
  fireEvent.change(input, { target: { value: 'My continuing work' } })
  for (let i = 0; i < 10; i++) { fireEvent.keyDown(input, { key: 'a' }); await advance(180000) }
  await click('Pause lesson')
  expect(screen.getByRole('timer').textContent).toBe('90:00')
  expect(screen.queryByRole('textbox')).toBeNull()
  await advance(3600000)
  expect(screen.getByRole('timer').textContent).toBe('90:00')
  await click('Resume lesson')
  expect(screen.getByRole('textbox')).toBe(input)
  expect(input.value).toBe('My continuing work')
  expect(screen.getByRole('timer').textContent).toBe('90:00')
})

it.each(['visibilitychange', 'offline', 'pagehide'])('pauses on %s and keeps content hidden until explicit resume', async event => {
  await open(); await advance(60000)
  await act(async () => {
    if (event === 'visibilitychange') { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event(event)) }
    else window.dispatchEvent(new Event(event))
  })
  expect(api.exit).toHaveBeenCalled()
  expect(screen.queryByRole('textbox')).toBeNull()
  const before = screen.getByRole('timer').textContent
  await advance(7200000)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  await click('Resume lesson')
  expect(screen.getByRole('timer').textContent).toBe(before)
  expect(screen.getByRole('textbox')).toBeTruthy()
})

it('warns before the five-minute inactivity pause and lets a reader keep studying', async () => {
  await open(); await advance(270000)
  expect(screen.getByRole('button', { name: 'Keep studying' })).toBeTruthy()
  await click('Keep studying'); await advance(60000)
  expect(screen.queryByRole('button', { name: 'Keep studying' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Pause lesson' })).toBeTruthy()
  await advance(240000)
  expect(screen.getByText(/paused after inactivity/)).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
})

it('does not mistake a playing recording for inactivity', async () => {
  const { container } = await open()
  Object.defineProperty(container.querySelector('video'), 'paused', { configurable: true, value: false })
  await advance(600000)
  expect(screen.getByRole('button', { name: 'Pause lesson' })).toBeTruthy()
  expect(used).toBe(600000)
})

it('closes only when the server confirms the exhausted budget', async () => {
  used = 7199000
  const closed = vi.fn(); await open(closed); await advance(1100)
  expect(closed).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect((screen.getByRole('button', { name: 'Resume lesson' }) as HTMLButtonElement).disabled).toBe(true)
})

it('fails closed on a heartbeat error without discarding the saved draft', async () => {
  await open(); const input = screen.getByRole('textbox') as HTMLInputElement
  fireEvent.change(input, { target: { value: 'Retain this' } })
  api.request.mockRejectedValueOnce(new Error('Disconnected'))
  await advance(30000)
  expect(screen.queryByRole('textbox')).toBeNull()
  await click('Resume lesson')
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Retain this')
})

it('ignores a pending start from a StrictMode cleanup', async () => {
  let release!: (value: StudySession) => void
  api.request.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  await act(async () => { render(<StrictMode><LessonStudySession enrollmentId="enrollment" lessonId="lesson"><p>Authorized lesson</p></LessonStudySession></StrictMode>) })
  await act(async () => { release({ ...reply(), study_token: 'old' }) })
  expect(api.exit).toHaveBeenCalledWith('enrollment', 'lesson', 'old')
  expect(screen.getByText('Authorized lesson').closest('[hidden]')).toBeNull()
})

it('does not request learner sessions for protected owner review', () => {
  render(<LessonStudySession lessonId="lesson"><p>Owner review</p></LessonStudySession>)
  expect(screen.getByText('Owner review')).toBeTruthy(); expect(api.request).not.toHaveBeenCalled()
})

it('restores the recording position when a paused media URL is refreshed', async () => {
  let video!: HTMLVideoElement
  await act(async () => { render(<LessonStudySession enrollmentId="enrollment" lessonId="lesson" onResume={async () => {
    video.currentTime = 0; fireEvent.loadedMetadata(video)
  }}><video ref={element => { if (element) video = element }} /></LessonStudySession>) })
  video.currentTime = 122
  await click('Pause lesson'); await click('Resume lesson')
  expect(video.currentTime).toBe(122)
})
