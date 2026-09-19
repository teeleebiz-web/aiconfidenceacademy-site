import { describe, expect, it } from 'vitest'
import { learnerAccessView } from './learnerAccess'
import type { Journey, JourneyIntroduction, LearnerLessonAccess, Lesson, LessonProgress } from './types'

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

const access = (lesson: Lesson, status: LearnerLessonAccess['access_status'] = 'available'): LearnerLessonAccess => ({
  current_lesson_id: lesson.id,
  current_journey_id: lesson.journey_id,
  access_status: status,
  available_at: '2026-09-19T09:00:00.000Z',
  active_seconds: 0,
  remaining_seconds: 7200,
  completed_lessons: lesson.course_position - 1,
  total_lessons: lessons.length,
  released_lesson_ids: lessons.slice(0, lesson.course_position).map(item => item.id),
})

describe('learnerAccessView', () => {
  it('shows only the one current lesson and its journey introduction', () => {
    const progress = completed(lessons.slice(0, 6).map((lesson) => lesson.id))
    const view = learnerAccessView({
      journeys,
      lessons,
      progress,
      introductions,
      accessState: access(lessons[6]),
    })

    expect(view.journeys.map((journey) => journey.journey_number)).toEqual([2])
    expect(view.lessons.map((lesson) => lesson.page_id)).toEqual(['2.1'])
    expect(view.introductions.map((item) => item.journey_id)).toEqual(['journey-2'])
  })

  it('gives a new learner only Lesson 1.1', () => {
    const view = learnerAccessView({
      journeys,
      lessons,
      progress: [],
      introductions,
      accessState: access(lessons[0]),
    })

    expect(view.journeys.map((journey) => journey.journey_number)).toEqual([1])
    expect(view.lessons.map((lesson) => lesson.page_id)).toEqual(['1.1'])
  })

  it('does not expose a scheduled lesson before its release time', () => {
    const view = learnerAccessView({
      journeys,
      lessons,
      progress: completed([lessons[0].id]),
      introductions,
      accessState: access(lessons[1], 'scheduled'),
    })

    expect(view.journeys).toEqual([])
    expect(view.lessons).toEqual([])
    expect(view.introductions).toEqual([])
  })
})
