import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoExperiencePreview, type PreviewLesson, type PreviewJourney } from './PhaseTwoExperiencePreview'

vi.mock('./PhaseTwoProducedLessonReview', () => ({
  validProducedLesson: (value: { lesson_id?: string; approval_status?: string } | undefined, pageId: string) =>
    value?.lesson_id === pageId && value.approval_status === 'founder_review_not_published',
  PhaseTwoProducedLessonReview: ({ production }: { production: { lesson_id: string } }) =>
    <section aria-label="Expanded production">{'Expanded production for lesson ' + production.lesson_id}</section>,
}))

const journeys: PreviewJourney[] = Array.from({ length: 6 }, (_, index) => ({
  id: 'journey-' + (index + 1),
  journey_number: index + 1,
  title: 'Synthetic Journey ' + (index + 1),
  promise: 'Verified working outcome',
}))

function makeLesson(index: number): PreviewLesson {
  const journey = Math.floor(index / 6) + 1
  const pos = index % 6 + 1
  const id = journey + '.' + pos
  return {
    id: 'lesson-' + (index + 1),
    journey_id: 'journey-' + journey,
    page_id: id,
    title: 'Synthetic lesson ' + id,
    purpose: 'Use verified judgment in the same project.',
    course_position: index + 1,
    journey_position: pos,
    content: {
      planned_media: pos <= 3 ? 'video' : 'audio',
      phase_two: {
        teaching: 'Original approved brief ' + id,
        worked_case: 'Synthetic case.',
        apply_to_project: 'Application.',
        ai_request: 'Approved AI request.',
        verify_and_save: 'Verification.',
        applied_completion_check: 'Applied evidence.',
      },
      ...(id === '1.1'
        ? { phase_two_production: {
            lesson_id: '1.1',
            approval_status: 'founder_review_not_published',
          } as unknown as NonNullable<PreviewLesson['content']['phase_two_production']> }
        : {}),
    },
  }
}

const lessons = Array.from({ length: 36 }, (_, i) => makeLesson(i))

describe('Phase Two protected production walkthrough', () => {
  it('shows expanded 1.1 and preserves the original brief for the next unexpanded lesson', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoExperiencePreview journeys={journeys} lessons={lessons} />)
    expect(screen.getByText('Expanded production for lesson 1.1')).toBeTruthy()
    expect(screen.queryByText('Original approved brief 1.1')).toBeNull()

    await user.click(screen.getByRole('button', { name: /1\.2.*Synthetic lesson 1\.2/i }))
    expect(screen.getByText('Original approved brief 1.2')).toBeTruthy()
    expect(screen.queryByText('Expanded production for lesson 1.1')).toBeNull()

    await user.click(screen.getByRole('button', { name: /1\.1.*Synthetic lesson 1\.1/i }))
    expect(screen.getByText('Expanded production for lesson 1.1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /submit|save project|complete lesson/i })).toBeNull()
  })

  it('flags an incomplete instructional draft without concealing the approved brief', () => {
    const broken = lessons.map((lesson, index) =>
      index === 0 ? {
        ...lesson,
        content: {
          ...lesson.content,
          phase_two_production: {
            lesson_id: '1.1',
            approval_status: 'incomplete',
          } as unknown as NonNullable<PreviewLesson['content']['phase_two_production']>,
        },
      } : lesson,
    )
    render(<PhaseTwoExperiencePreview journeys={journeys} lessons={broken} />)
    expect(screen.getByRole('alert').textContent).toContain('incomplete')
    expect(screen.getByText('Original approved brief 1.1')).toBeTruthy()
  })
})
