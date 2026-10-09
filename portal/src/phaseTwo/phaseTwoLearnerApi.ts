/**
 * Phase Two learner-only access APIs.
 *
 * Protected teaching stays server-side. The outline returns only metadata.
 * Opening a lesson is a deliberate authenticated RPC; a browser refresh never
 * creates a fresh weekday deadline. No course is activated by this module.
 */
import { supabase } from '../lib/supabase'
import type { PhaseTwoProducedLesson } from './PhaseTwoProducedLessonReview'

export type PhaseTwoLessonOutline = {
  lesson_id: string
  journey_number: number
  lesson_number: number
  page_id: string
  journey_title: string
  lesson_title: string
  planned_media: 'video' | 'audio' | null
  released_at: string
  access_status: 'scheduled' | 'available' | 'active' | 'closed'
  deadline_at: string | null
  remaining_seconds: number
}

export type PhaseTwoTeachingBrief = {
  teaching: string
  worked_case: string
  apply_to_project: string
  ai_request: string
  verify_and_save: string
  applied_completion_check: string
  weekday?: string
}

export type PhaseTwoOpenedLesson = {
  page_id: string
  lesson_title: string
  lesson_purpose: string
  lesson_content: {
    phase_two?: PhaseTwoTeachingBrief
    phase_two_production?: PhaseTwoProducedLesson
    phase_two_media_plan?: {
      avatar_introduction?: { url: string; transcript: string; approvalStatus: 'founder_approved' }
      audio_lesson?: { generated_introduction?: { url: string; transcript: string } }
    }
    planned_media?: 'video' | 'audio'
    video_path?: string | null
    audio_path?: string | null
  }
  closes_at: string
  remaining_seconds: number
}

export async function loadPhaseTwoOutline(enrollmentId: string): Promise<PhaseTwoLessonOutline[]> {
  const { data, error } = await supabase.rpc('aca_phase_two_my_outline', {
    p_enrollment_id: enrollmentId,
  })
  if (error || !Array.isArray(data)) throw new Error('The Phase Two learning schedule is unavailable.')
  return data as PhaseTwoLessonOutline[]
}

export async function openPhaseTwoLesson(
  enrollmentId: string,
  lessonId: string,
): Promise<PhaseTwoOpenedLesson> {
  const { data, error } = await supabase.rpc('open_aca_phase_two_lesson', {
    p_enrollment_id: enrollmentId, p_lesson_id: lessonId,
  })
  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error('The lesson could not open. Check its release or access window and try again.')
  }
  return data[0] as PhaseTwoOpenedLesson
}

export async function loadPhaseTwoLessonAccess(enrollmentId: string, lessonId: string) {
  const { data, error } = await supabase.rpc('aca_phase_two_access_status', {
    p_enrollment_id: enrollmentId, p_lesson_id: lessonId,
  })
  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error('Lesson access could not be checked.')
  }
  return data[0] as {
    access_status: PhaseTwoLessonOutline['access_status']
    released_at: string
    deadline_at: string | null
    remaining_seconds: number
  }
}
