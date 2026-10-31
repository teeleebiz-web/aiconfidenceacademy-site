import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoLearnerHome } from './PhaseTwoLearnerHome'
import type { PhaseTwoLessonOutline } from './phaseTwoLearnerApi'

const api = vi.hoisted(() => ({
  outline: vi.fn(),
  open: vi.fn(),
}))

vi.mock('./phaseTwoLearnerApi', () => ({
  loadPhaseTwoOutline: api.outline,
  openPhaseTwoLesson: api.open,
}))
vi.mock('./PhaseTwoProjectWorkspace', () => ({
  PhaseTwoProjectWorkspace: ({ enrollmentId }: { enrollmentId: string }) => (
    <section>Protected continuing project for {enrollmentId}</section>
  ),
}))

const scheduled: PhaseTwoLessonOutline[] = Array.from({ length: 36 }, (_, index) => {
  const journey = Math.floor(index / 6) + 1
  const lesson = index % 6 + 1
  return {
    lesson_id: 'lesson-' + (index + 1),
    journey_number: journey,
    lesson_number: lesson,
    page_id: journey + '.' + lesson,
    journey_title: 'Journey topic ' + journey,
    lesson_title: 'Lesson topic ' + journey + '.' + lesson,
    planned_media: lesson % 2 === 0 ? 'video' : 'audio',
    released_at: new Date('2026-11-01T09:00:00Z').toISOString(),
    access_status: index === 0 ? 'available' : 'scheduled',
    deadline_at: null,
    remaining_seconds: 0,
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  api.outline.mockResolvedValue(scheduled)
  api.open.mockResolvedValue({
    page_id: '1.1', lesson_title: 'Lesson topic 1.1',
    lesson_purpose: 'Apply the approved project framework.',
    lesson_content: {
      planned_media: 'audio',
      phase_two: {
        teaching: 'Private approved teaching.',
        worked_case: 'A verified business case.',
        apply_to_project: 'Update the same project.',
        ai_request: 'Ask AI a grounded question.',
        verify_and_save: 'Check your evidence.',
        applied_completion_check: 'Defend a human decision.',
      },
    },
    closes_at: new Date(Date.now() + 7_200_000).toISOString(),
    remaining_seconds: 7200,
  })
})

describe('Phase Two learner experience (staged, not activated)', () => {
  it('shows exactly six journeys and locks lessons before their release', async () => {
    render(<PhaseTwoLearnerHome enrollmentId="enrollment-1" />)
    expect(await screen.findByRole('heading', { name: 'AI Professional and Builder Pathway' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { name: /Journey topic \d/ })).toHaveLength(6)
    expect(screen.getAllByRole('button', { name: 'Not open' })).toHaveLength(35)
    expect(screen.getByRole('button', { name: 'Begin lesson' })).toBeTruthy()
    expect(screen.queryByText('Private approved teaching.')).toBeNull()
    expect(api.open).not.toHaveBeenCalled()
  })

  it('fetches protected teaching only after an authorized lesson opening', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoLearnerHome enrollmentId="enrollment-1" />)
    await user.click(await screen.findByRole('button', { name: 'Begin lesson' }))
    expect(api.open).toHaveBeenCalledWith('enrollment-1', 'lesson-1')
    expect(await screen.findByText('Private approved teaching.')).toBeTruthy()
    expect(screen.getByText('Defend a human decision.')).toBeTruthy()
    expect(screen.getByText(/saving work does not automatically award completion/i)).toBeTruthy()
  })

  it('keeps one continuing project record outside the lesson player', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoLearnerHome enrollmentId="enrollment-1" />)
    await screen.findByRole('heading', { name: 'AI Professional and Builder Pathway' })
    await user.click(screen.getByRole('button', { name: 'My Project Record' }))
    expect(screen.getByText('Protected continuing project for enrollment-1')).toBeTruthy()
    expect(api.open).not.toHaveBeenCalled()
  })

  it('refuses to present a partial or duplicate lesson schedule as complete', async () => {
    api.outline.mockResolvedValueOnce(scheduled.slice(0, 35))
    render(<PhaseTwoLearnerHome enrollmentId="enrollment-1" />)
    expect(await screen.findByText(/complete six-journey schedule is not ready/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Begin lesson' })).toBeNull()
  })
})


describe('Phase Two live schedule state', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-31T04:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  const closedOutline = (): PhaseTwoLessonOutline[] => scheduled.map(item => ({ ...item, access_status: 'closed', released_at: new Date(Date.now() - 86_400_000).toISOString(), deadline_at: new Date(Date.now() - 1000).toISOString() }))
  const openedLesson = (seconds: number) => ({
    page_id: '1.1', lesson_title: 'Lesson topic 1.1', lesson_purpose: 'Test access.',
    lesson_content: { phase_two: { teaching: 'Authorized fixture teaching.' } },
    closes_at: new Date(Date.now() + seconds * 1000).toISOString(), remaining_seconds: seconds,
  })
  const row = () => screen.getByRole('heading', { name: 'Lesson topic 1.1' }).closest('article')!

  it('marks the expired row closed immediately while retaining the project route', async () => {
    const items = closedOutline(); items[0] = { ...items[0], access_status: 'available', deadline_at: null }
    api.outline.mockResolvedValue(items); api.open.mockResolvedValue(openedLesson(1))
    await act(async () => { render(<PhaseTwoLearnerHome enrollmentId="enrollment-1" />) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Begin lesson' })) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })
    expect(screen.getByText(/window has closed/i)).toBeTruthy()
    expect((within(row()).getByRole('button', { name: 'Not open' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'My Project Record' }) as HTMLButtonElement).disabled).toBe(false)
    expect(api.open).toHaveBeenCalledTimes(1)
  })

  it('shows resume after opening and returning without opening another window', async () => {
    const items = closedOutline(); items[0] = { ...items[0], access_status: 'available', deadline_at: null }
    api.outline.mockResolvedValue(items); api.open.mockResolvedValue(openedLesson(60))
    await act(async () => { render(<PhaseTwoLearnerHome enrollmentId="enrollment-1" />) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Begin lesson' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Your lessons' })) })
    expect(within(row()).getByRole('button', { name: 'Resume lesson' })).toBeTruthy()
    expect(api.open).toHaveBeenCalledTimes(1)
  })

  it('refreshes a scheduled release without a page reload or teaching request', async () => {
    const waiting = closedOutline(); waiting[0] = { ...waiting[0], access_status: 'scheduled', released_at: new Date(Date.now() + 2000).toISOString(), deadline_at: null }
    const ready = waiting.map((item, index) => index === 0 ? { ...item, access_status: 'available' } : item)
    api.outline.mockReset().mockResolvedValueOnce(waiting).mockResolvedValue(ready)
    await act(async () => { render(<PhaseTwoLearnerHome enrollmentId="enrollment-1" />) })
    expect((within(row()).getByRole('button', { name: 'Not open' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
    expect((within(row()).getByRole('button', { name: 'Begin lesson' }) as HTMLButtonElement).disabled).toBe(false)
    expect(api.open).not.toHaveBeenCalled()
  })

  it('refreshes authoritative metadata when the learner returns to the window', async () => {
    const ready = closedOutline(); ready[0] = { ...ready[0], access_status: 'available', deadline_at: null }
    api.outline.mockReset().mockResolvedValueOnce(ready).mockResolvedValue(closedOutline())
    await act(async () => { render(<PhaseTwoLearnerHome enrollmentId="enrollment-1" />) })
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect((within(row()).getByRole('button', { name: 'Not open' }) as HTMLButtonElement).disabled).toBe(true)
    expect(api.open).not.toHaveBeenCalled()
  })
})
