import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from './Dashboard'
import type { Enrollment, Journey, JourneyIntroduction, Lesson } from '../types'

const enrollment: Enrollment = {
  id: 'enrollment-1',
  learner_id: 'learner-1',
  course_id: 'course-1',
  status: 'active',
  starts_at: null,
  access_expires_at: null,
  course: { id: 'course-1', code: 'sample', title: 'Sample Course', summary: 'A synthetic course.' },
}

const journey: Journey = {
  id: 'journey-1',
  course_id: 'course-1',
  journey_number: 1,
  week_number: 1,
  title: 'Sample Journey',
  promise: 'A synthetic promise.',
  release_offset_days: 0,
  status: 'published',
}

const introduction: JourneyIntroduction = {
  id: 'intro-1',
  journey_id: 'journey-1',
  media_kind: 'video',
  media_path: null,
  caption_path: null,
  duration_seconds: 310,
  status: 'published',
  source_version: 'synthetic-test-v1',
  content: {
    eyebrow: 'Begin Journey 1',
    title: 'Sample Journey Welcome',
    lead: 'A synthetic lead.',
    outcomes: [],
    roadmap: [],
    transcript: [],
    closing: 'Continue.',
  },
}

const lesson = {
  id: 'lesson-1',
  journey_id: 'journey-1',
  page_id: '1.1',
  title: 'Sample Lesson',
  estimated_minutes: 35,
} as Lesson

describe('Dashboard', () => {
  it('places the journey welcome before the lesson list', async () => {
    const user = userEvent.setup()
    const opened: string[] = []

    render(
      <Dashboard
        enrollment={enrollment}
        journeys={[journey]}
        lessons={[lesson]}
        progress={[]}
        introductions={[introduction]}
        learnerName="Learner"
        onOpenLesson={() => undefined}
        onOpenIntroduction={(item) => opened.push(item.id)}
      />,
    )

    const welcomeButton = screen.getByRole('button', { name: /begin journey/i })
    const lessonButton = screen.getByRole('button', { name: /open lesson/i })
    expect(welcomeButton.compareDocumentPosition(lessonButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(welcomeButton)
    expect(opened).toEqual(['intro-1'])
  })

  it('labels unpublished material in protected owner review mode', () => {
    render(
      <Dashboard
        enrollment={enrollment}
        journeys={[{ ...journey, status: 'draft' }]}
        lessons={[{ ...lesson, status: 'draft' }]}
        progress={[]}
        introductions={[{ ...introduction, status: 'draft' }]}
        learnerName="Owner"
        reviewMode
        onOpenLesson={() => undefined}
        onOpenIntroduction={() => undefined}
      />,
    )

    expect(screen.getByText(/protected owner review/i)).toBeTruthy()
    expect(screen.getByText(/1 journeys · 1 lessons · 1 drafts/i)).toBeTruthy()
    expect(screen.getAllByText(/draft/i).length).toBeGreaterThan(1)
  })
})
