import { useEffect, useState } from 'react'

export type LessonAccess = {
  access_status: 'active' | 'completed' | 'expired'
  active_seconds: number
  remaining_seconds: number
  hard_expires_at?: string | null
}

export function LessonClock({
  access,
  onHeartbeat,
  onResume,
}: {
  access: LessonAccess
  onHeartbeat: () => Promise<void>
  onResume: () => Promise<void>
}) {
  const [remaining, setRemaining] = useState(access.remaining_seconds)

  useEffect(() => setRemaining(access.remaining_seconds), [access.remaining_seconds])

  useEffect(() => {
    if (access.access_status !== 'active') return
    const deadline = access.hard_expires_at ? Date.parse(access.hard_expires_at) : Date.now() + access.remaining_seconds * 1000
    const countdown = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000)
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') void onHeartbeat()
    }, 30000)
    const resume = () => {
      if (document.visibilityState === 'visible') void onResume()
    }
    document.addEventListener('visibilitychange', resume)
    return () => {
      window.clearInterval(countdown)
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [access, onHeartbeat, onResume])

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
            ? 'Your lesson has closed.'
            : 'Your lesson closes two hours after opening.'}
      </small>
    </aside>
  )
}
