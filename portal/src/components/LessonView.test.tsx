import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LessonView } from './LessonView'
import type { Lesson } from '../types'

const lesson: Lesson = {
  id: 'lesson-1',
  course_id: 'course-1',
  journey_id: 'journey-1',
  page_id: '1.1',
  title: 'A Sample Learner Lesson',
  purpose: 'Verify the learner interaction without embedding curriculum content.',
  estimated_minutes: 35,
  course_position: 1,
  journey_position: 1,
  unlock_offset_days: 0,
  status: 'published',
  content: {
    outcomes: ['Complete a guided practice and save a reflection.'],
    vocabulary: { Reflection: 'A short record of what the learner noticed.' },
    teaching: ['This synthetic fixture tests the lesson interface only.'],
    examples: [],
    practice_prompt: 'Help me organize a simple, non-private practice task.',
    practice_steps: ['Begin the practice.', 'Review the result.', 'Make one revision.'],
    revision: 'Revise the result until it fits the stated purpose.',
    artifact: 'My Sample Reflection',
    stay_engaged: 'Name one next practice step.',
    optional: 'Write one question for the next lesson.',
    knowledge_check: [{ q: 'Who makes the final decision about using an AI response?' }],
    review_questions: ['Does this response fit your purpose?'],
    rhythm: 'See it -> Say it -> Ask it -> Shape it -> Check it -> Use it -> Save it',
    accessibility: 'Use readable text and keyboard-accessible controls.',
  },
}

describe('LessonView', () => {
  it('requires meaningful work, then saves the learner artifact', async () => {
    const user = userEvent.setup()
    const saved: string[] = []

    render(
      <LessonView
        lesson={lesson}
        onBack={() => undefined}
        onSave={async (response) => {
          saved.push(response)
        }}
      />,
    )

    expect(screen.getByText(/45 minute session/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /complete learning rhythm/i })).toBeTruthy()
    expect(screen.getByText(/optional continuation is available after the core session/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /save and complete/i }))
    expect(screen.getByRole('status').textContent).toMatch(/thoughtful words/i)

    await user.type(
      screen.getByLabelText(/evidence you want to save/i),
      'I want to use AI with better judgment. I want confidence to shape and verify what it gives me.',
    )
    await user.click(screen.getByRole('button', { name: /save and complete/i }))

    expect(saved).toEqual([
      'I want to use AI with better judgment. I want confidence to shape and verify what it gives me.',
    ])
    expect(screen.getByRole('status').textContent).toMatch(/lesson 1.1 is complete/i)
  })

  it('never renders answer keys in learner-facing knowledge checks', () => {
    render(
      <LessonView
        lesson={lesson}
        onBack={() => undefined}
        onSave={async () => undefined}
      />,
    )

    expect(screen.getByText('Who makes the final decision about using an AI response?')).toBeTruthy()
    expect(screen.queryByText(/^The learner\.$/)).toBeNull()
  })

  it('keeps owner review read-only and supports adjacent-lesson navigation', async () => {
    const user = userEvent.setup()
    const nextLesson = { ...lesson, id: 'lesson-2', page_id: '1.2', status: 'draft' as const }
    const opened: string[] = []

    render(
      <LessonView
        lesson={{ ...lesson, status: 'draft' }}
        reviewMode
        nextLesson={nextLesson}
        onBack={() => undefined}
        onSave={async () => { throw new Error('Review mode must not save.') }}
        onOpenLesson={(item) => opened.push(item.id)}
      />,
    )

    expect(screen.getByText(/unpublished draft/i)).toBeTruthy()
    expect(screen.queryByLabelText(/evidence you want to save/i)).toBeNull()
    expect(screen.getByText(/learner evidence target/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /lesson 1.2/i }))
    expect(opened).toEqual(['lesson-2'])
  })
})
