import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoLearnerHome } from './PhaseTwoLearnerHome'

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

const scheduled = Array.from({ length: 36 }, (_, index) => {
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
