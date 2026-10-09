import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoLessonExperience } from './PhaseTwoLessonExperience'

const api = vi.hoisted(() => ({ validate: vi.fn() }))
vi.mock('./PhaseTwoProducedLessonReview', () => ({
  validProducedLesson: api.validate,
  PhaseTwoProducedLessonReview: ({ learnerMode }: { learnerMode?: boolean }) =>
    <section aria-label="Expanded learner instruction">{learnerMode ? 'Lesson teaching and practice' : 'Administrative presentation'}</section>,
}))

beforeEach(() => { vi.clearAllMocks(); api.validate.mockReturnValue(true) })

describe('Phase Two learner lesson presentation', () => {
  it('opens directly on the lesson with one medium placeholder and no build administration', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.1"
      lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Identify human responsibility, capability and evidence."
      medium="audio"
      production={{ lesson_id: '1.1' } as never}
    />)
    expect(screen.getByRole('heading', { name: 'Professional AI judgment and direction' })).toBeTruthy()
    expect(screen.getByText('Audio placeholder')).toBeTruthy()
    expect(screen.getByText('Lesson teaching and practice')).toBeTruthy()
    expect(screen.queryByText(/founder|unpublished|publishing|preview|provisional|video slots|audio slots|course inventory/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /submit|award|publish/i })).toBeNull()
  })

  it('reuses existing lesson and project navigation for an enrolled learner', async () => {
    const user=userEvent.setup()
    const back=vi.fn(), project=vi.fn()
    render(<PhaseTwoLessonExperience
      pageId="1.1" lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Identify human responsibility." medium="audio"
      production={{ lesson_id: '1.1' } as never}
      remainingSeconds={3410} onBackToLessons={back} onOpenProject={project}
    />)
    expect(screen.getByText('Time remaining: 56 min')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Your lessons' }))
    await user.click(screen.getByRole('button', { name: 'Open My Project Record' }))
    expect(back).toHaveBeenCalledTimes(1)
    expect(project).toHaveBeenCalledTimes(1)
  })

  it('does not display a partial instructional package as a completed lesson', () => {
    api.validate.mockReturnValue(false)
    render(<PhaseTwoLessonExperience
      pageId="1.1" lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1" purpose="Judgment." medium="audio"
      production={undefined}
    />)
    expect(screen.getByRole('alert').textContent).toMatch(/lesson is temporarily unavailable/i)
    expect(screen.queryByText('Lesson teaching and practice')).toBeNull()
  })
})
