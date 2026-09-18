import { useEffect, useState } from 'react'

export type LessonAccess = {
  access_status: 'active' | 'completed' | 'expired'
  active_seconds: number
  remaining_seconds: number
  hard_expires_at: string
  recovery_used: boolean
  recovery_expires_at: string | null
}

export function LessonClock({ access, onHeartbeat }: { access: LessonAccess; onHeartbeat: () => Promise<void> }) {
  const [remaining, setRemaining] = useState(access.remaining_seconds)

  useEffect(() => setRemaining(access.remaining_seconds), [access.remaining_seconds])

  useEffect(() => {
    if (access.access_status !== 'active') return
    const countdown = window.setInterval(() => {
      if (document.visibilityState === 'visible') setRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') void onHeartbeat()
    }, 30000)
    return () => {
      window.clearInterval(countdown)
      window.clearInterval(heartbeat)
    }
  }, [access.access_status, onHeartbeat])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <aside className={`lesson-clock lesson-clock-${access.access_status}`} aria-live="polite">
      <span>Lesson time remaining</span>
      <strong>{minutes}:{seconds.toString().padStart(2, '0')}</strong>
      <small>
        {access.access_status === 'completed'
          ? 'Lesson completed.'
          : access.access_status === 'expired'
            ? 'This lesson window has ended. Contact ACA support for assistance.'
            : 'Your time and workbook work are saved if you leave.'}
      </small>
    </aside>
  )
}
