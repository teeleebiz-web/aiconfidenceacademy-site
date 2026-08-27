export type LessonContent = {
  outcomes: string[]
  vocabulary: Record<string, string>
  teaching: string[]
  examples: string[]
  practice_prompt: string
  practice_steps: string[]
  revision: string
  artifact: string
  stay_engaged: string
  optional: string
  knowledge_check: Array<{ q: string }>
  review_questions: string[]
  rhythm: string
  accessibility: string
}

export type Course = {
  id: string
  code: string
  title: string
  summary: string | null
}

export type Enrollment = {
  id: string
  learner_id: string
  course_id: string
  status: string
  starts_at: string | null
  access_expires_at: string | null
  course: Course
}

export type Journey = {
  id: string
  course_id: string
  journey_number: number
  week_number: number
  title: string
  promise: string
  release_offset_days: number
}

export type Lesson = {
  id: string
  course_id: string
  journey_id: string
  page_id: string
  title: string
  purpose: string
  estimated_minutes: number
  course_position: number
  journey_position: number
  unlock_offset_days: number
  content: LessonContent
}

export type LessonProgress = {
  id: string
  lesson_id: string
  status: 'not_started' | 'in_progress' | 'completed'
  last_step: number
  artifact_saved: boolean
}
