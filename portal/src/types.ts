export type LessonContent = {
  teaching_heading?: string
  audio_path?: string | null
  outcomes: string[]
  vocabulary: Record<string, string>
  teaching: string[]
  examples: string[]
  practice_prompt: string
  practice_steps: string[]
  revision?: string
  required_revision?: string
  artifact: string
  stay_engaged: string
  optional?: string
  optional_practice?: string
  knowledge_check: Array<{ q: string }>
  review_questions: string[]
  rhythm: string
  accessibility: string
  practice_material?: string | null
  support?: string
  completion_gate?: string
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
  status: 'draft' | 'published' | 'archived'
}

export type TranscriptSegment = {
  timecode?: string
  speaker?: string
  text: string
}

export type JourneyIntroductionContent = {
  eyebrow: string
  title: string
  lead: string
  outcomes: string[]
  roadmap: Array<{
    page_id: string
    title: string
    purpose: string
  }>
  transcript: TranscriptSegment[]
  avatar_transcript?: TranscriptSegment[]
  audio_transcript?: TranscriptSegment[]
  closing: string
}

export type JourneyIntroduction = {
  id: string
  journey_id: string
  media_kind: 'video' | 'audio'
  media_path: string | null
  caption_path: string | null
  companion_audio_path?: string | null
  companion_caption_path?: string | null
  duration_seconds: number
  content: JourneyIntroductionContent
  status: 'draft' | 'published' | 'archived'
  source_version: string
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
  status: 'draft' | 'published' | 'archived'
  content: LessonContent
}

export type LessonProgress = {
  id: string
  lesson_id: string
  status: 'not_started' | 'in_progress' | 'completed'
  last_step: number
  artifact_saved: boolean
}
