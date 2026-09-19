import type { Journey, JourneyIntroduction, LearnerLessonAccess, Lesson, LessonProgress } from './types'

type LearnerAccessInput = {
  journeys: Journey[]
  lessons: Lesson[]
  progress: LessonProgress[]
  introductions: JourneyIntroduction[]
  accessState: LearnerLessonAccess | null
}

export function learnerAccessView({ journeys, lessons, progress, introductions, accessState }: LearnerAccessInput) {
  if (
    !accessState?.current_lesson_id
    || !['available', 'active'].includes(accessState.access_status)
  ) {
    return { journeys: [], lessons: [], progress: [], introductions: [] }
  }

  const currentLesson = lessons.find((lesson) => lesson.id === accessState.current_lesson_id)
  if (!currentLesson) {
    return { journeys: [], lessons: [], progress: [], introductions: [] }
  }

  const currentJourney = journeys.find((journey) => journey.id === currentLesson.journey_id)
  if (!currentJourney) {
    return { journeys: [], lessons: [], progress: [], introductions: [] }
  }

  return {
    journeys: [currentJourney],
    lessons: [currentLesson],
    progress: progress.filter((item) => item.lesson_id === currentLesson.id),
    introductions: introductions.filter((item) => item.journey_id === currentJourney.id),
  }
}
