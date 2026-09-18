import type { Journey, JourneyIntroduction, Lesson, LessonProgress } from './types'

type LearnerAccessInput = {
  journeys: Journey[]
  lessons: Lesson[]
  progress: LessonProgress[]
  introductions: JourneyIntroduction[]
}

export function learnerAccessView({ journeys, lessons, progress, introductions }: LearnerAccessInput) {
  const orderedJourneys = [...journeys].sort((a, b) => a.journey_number - b.journey_number)
  const completedLessonIds = new Set(
    progress.filter((item) => item.status === 'completed').map((item) => item.lesson_id),
  )
  const journeysWithLessons = orderedJourneys.filter((journey) =>
    lessons.some((lesson) => lesson.journey_id === journey.id),
  )
  const activeJourney =
    journeysWithLessons.find((journey) =>
      lessons.some(
        (lesson) => lesson.journey_id === journey.id && !completedLessonIds.has(lesson.id),
      ),
    ) ?? journeysWithLessons.at(-1)

  if (!activeJourney) {
    return { journeys: [], lessons: [], progress: [], introductions: [] }
  }

  const activeLessons = lessons
    .filter((lesson) => lesson.journey_id === activeJourney.id)
    .sort((a, b) => a.journey_position - b.journey_position)
    .slice(0, 6)
  const activeLessonIds = new Set(activeLessons.map((lesson) => lesson.id))

  return {
    journeys: [activeJourney],
    lessons: activeLessons,
    progress: progress.filter((item) => activeLessonIds.has(item.lesson_id)),
    introductions: introductions.filter((item) => item.journey_id === activeJourney.id),
  }
}
