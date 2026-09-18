import { describe, expect, it } from 'vitest'
import { learnerAccessView } from './learnerAccess'
import type { Journey, JourneyIntroduction, Lesson, LessonProgress } from './types'

const journeys = [1, 2, 3].map((number) => ({
  id: `journey-${number}`,
  course_id: 'course',
  journey_number: number,
  week_number: number,
  title: `Journey ${number}`,
  promise: 'Practice.',
  release_offset_days: number - 1,
  status: 'published' as const,
})) satisfies Journey[]

const lessons = journeys.flatMap((journey) =>
  Array.from({ length: 6 }, (_, index) => ({
    id: `${journey.id}-lesson-${index + 1}`,
    course_id: 'course',
    journey_id: journey.id,
    page_id: `${journey.journey_number}.${index + 1}`,
    title: `Lesson ${journey.journey_number}.${index + 1}`,
    purpose: 'Practice.',
    estimated_minutes: 45,
    course_position: (journey.journey_number - 1) * 6 + index + 1,
    journey_position: index + 1,
    unlock_offset_days: index,
    status: 'published' as const,
    content: {
      outcomes: [], vocabulary: {}, teaching: [], examples: [], practice_prompt: '',
      practice_steps: [], artifact: '', stay_engaged: '', knowledge_check: [],
      review_questions: [], rhythm: '', accessibility: '',
    },
  })),
) satisfies Lesson[]

const introductions = journeys.map((journey) => ({
  id: `intro-${journey.id}`,
  journey_id: journey.id,
  media_kind: 'video' as const,
  media_path: null,
  caption_path: null,
  duration_seconds: 60,
  content: { eyebrow: '', title: '', lead: '', outcomes: [], roadmap: [], transcript: [], closing: '' },
  status: 'published' as const,
  source_version: 'test',
})) satisfies JourneyIntroduction[]

const completed = (lessonIds: string[]) => lessonIds.map((lessonId, index) => ({
  id: `progress-${index}`,
  lesson_id: lessonId,
  status: 'completed' as const,
  last_step: 7,
  artifact_saved: true,
})) satisfies LessonProgress[]

describe('learnerAccessView', () => {
  it('shows only the first incomplete journey and its six lessons', () => {
    const progress = completed(lessons.slice(0, 6).map((lesson) => lesson.id))
    const view = learnerAccessView({ journeys, lessons, progress, introductions })

    expect(view.journeys.map((journey) => journey.journey_number)).toEqual([2])
    expect(view.lessons.map((lesson) => lesson.page_id)).toEqual(['2.1', '2.2', '2.3', '2.4', '2.5', '2.6'])
    expect(view.introductions.map((item) => item.journey_id)).toEqual(['journey-2'])
  })

  it('keeps a new learner inside Journey 1', () => {
    const view = learnerAccessView({ journeys, lessons, progress: [], introductions })

    expect(view.journeys.map((journey) => journey.journey_number)).toEqual([1])
    expect(view.lessons).toHaveLength(6)
  })

  it('keeps a completed learner on the final journey instead of reopening earlier work', () => {
    const progress = completed(lessons.map((lesson) => lesson.id))
    const view = learnerAccessView({ journeys, lessons, progress, introductions })

    expect(view.journeys.map((journey) => journey.journey_number)).toEqual([3])
    expect(view.lessons.every((lesson) => lesson.journey_id === 'journey-3')).toBe(true)
  })
})
