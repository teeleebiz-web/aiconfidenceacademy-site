export type LessonAccess = {
  access_status: 'active' | 'completed' | 'expired'
  active_seconds: number
  remaining_seconds: number
  hard_expires_at?: string | null
}

