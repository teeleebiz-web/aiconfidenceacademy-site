import { projectUrl, publishableKey, supabase } from './supabase'

export type StudySession = {
  access_status: 'active' | 'expired' | 'superseded'
  study_state: 'running' | 'paused' | 'ended'
  active_seconds: number
  remaining_seconds: number
  study_token: string | null
  limit_at: string | null
  study_mode: 'budget' | 'weekend' | 'extension'
}
let authorization: string | null = null

export async function requestStudySession(enrollmentId: string, lessonId: string,
  action: 'start' | 'heartbeat' | 'pause', token: string | null): Promise<StudySession> {
  const session = await supabase.auth.getSession()
  authorization = session.data.session?.access_token ?? null
  const { data, error } = await supabase.rpc('manage_lesson_study_session', {
    p_enrollment_id: enrollmentId, p_lesson_id: lessonId, p_action: action, p_token: token,
  })
  if (error || !data?.[0]) throw new Error('Your lesson time could not be checked. It has been paused. Please try again.')
  return data[0] as StudySession
}

// Best effort on page exit. If the browser/power/network disappears, the server
// preserves the last confirmed study checkpoint instead of billing the gap.
export function pauseStudyOnExit(enrollmentId: string, lessonId: string, token: string | null) {
  if (!authorization) return
  void fetch(`${projectUrl}/rest/v1/rpc/manage_lesson_study_session`, {
    method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json', apikey: publishableKey, Authorization: `Bearer ${authorization}` },
    body: JSON.stringify({ p_enrollment_id: enrollmentId, p_lesson_id: lessonId, p_action: 'pause', p_token: token }),
  }).catch(() => { /* The server checkpoint is the fallback. */ })
}
