import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoLessonExperience } from './PhaseTwoLessonExperience'

const api = vi.hoisted(() => ({ validate: vi.fn() }))
vi.mock('./PhaseTwoProducedLessonReview', () => ({
  validProducedLesson: api.validate,
  PhaseTwoProducedLessonReview: ({ learnerMode }: { learnerMode?: boolean }) =>
    <section aria-label="Expanded learner instruction">{learnerMode ? 'Lesson teaching and practice' : 'Administrative presentation'}</section>,
}))

const lessonProduction = {
  lesson_id: '1.1',
  pacing: [
    { key: 'teaching', label: 'Teaching', minutes: 15 },
    { key: 'worked_case', label: 'Worked case', minutes: 10 },
    { key: 'application', label: 'Application', minutes: 25 },
    { key: 'verification', label: 'Verification', minutes: 10 },
  ],
} as never

beforeEach(() => { vi.clearAllMocks(); api.validate.mockReturnValue(true) })

describe('Phase Two learner lesson presentation', () => {
  it('opens directly on the lesson with one medium placeholder and no build administration', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.1"
      lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Identify human responsibility, capability and evidence."
      medium="audio"
      production={lessonProduction}
    />)
    expect(screen.getByRole('heading', { name: 'Professional AI judgment and direction' })).toBeTruthy()
    expect(screen.getByText('Audio placeholder')).toBeTruthy()
    expect(screen.getAllByText('Audio placeholder')).toHaveLength(1)
    expect(screen.queryByText('Video placeholder')).toBeNull()
    expect(screen.getByText('Lesson teaching and practice')).toBeTruthy()
    expect(screen.queryByText(/founder|unpublished|publishing|preview|provisional|video slots|audio slots|course inventory/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /submit|award|publish/i })).toBeNull()
  })

  it('shows one video introduction but no competing audio when the lesson is video-led', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.2" lessonTitle="Find the need and establish the evidence"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Find an actual problem and test assumptions."
      medium="video" production={lessonProduction}
    />)
    expect(screen.getByText('Video placeholder')).toBeTruthy()
    expect(screen.getAllByText('Video placeholder')).toHaveLength(1)
    expect(screen.queryByText('Audio placeholder')).toBeNull()
  })

  it('displays a supplied instructor video at the established 16:9 media position without replacing teaching', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.1"
      lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Choose and verify a professional task."
      medium="audio"
      production={lessonProduction}
      introVideo={{ url: 'https://aiconfidenceacademy.org/assets/test-approved-instructor.mp4',
        transcript: 'Welcome to the Academy.\n\nLet us begin.', approvalStatus: 'founder_approved' }}
    />)
    const video = screen.getByLabelText('Lesson 1.1 instructor introduction video')
    expect(video.tagName.toLowerCase()).toBe('video')
    expect(video.getAttribute('src')).toBe('https://aiconfidenceacademy.org/assets/test-approved-instructor.mp4')
    expect(video).toHaveProperty('controls', true)
    expect(screen.getByText('Lesson teaching and practice')).toBeTruthy()
    expect(screen.getByText('Audio placeholder')).toBeTruthy()
    expect(screen.getByText('Read the lesson introduction')).toBeTruthy()
  })

  it('rejects a video marked as pending founder review even if its URL and transcript exist', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.1"
      lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Practice sound professional judgment."
      medium="audio"
      production={lessonProduction}
      introVideo={{
        url: 'https://aiconfidenceacademy.org/assets/pending-instructor.mp4',
        transcript: 'An unapproved recording must not appear.',
        approvalStatus: 'pending_review' as never,
      }}
    />)
    expect(screen.queryByLabelText('Lesson 1.1 instructor introduction video')).toBeNull()
  })

  it('does not attach a presenter video by default while its preview awaits acceptance', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.1"
      lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Choose and verify a professional task."
      medium="audio"
      production={lessonProduction}
    />)
    expect(screen.queryByLabelText('Lesson 1.1 instructor introduction video')).toBeNull()
  })

  it('reuses existing lesson and project navigation for an enrolled learner', async () => {
    const user=userEvent.setup()
    const back=vi.fn(), project=vi.fn()
    render(<PhaseTwoLessonExperience
      pageId="1.1" lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Identify human responsibility." medium="audio"
      production={lessonProduction}
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
