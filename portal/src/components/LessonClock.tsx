import { useEffect, useState } from 'react'

export type LessonAccess = {
  access_status: 'active' | 'completed' | 'expired'
  active_seconds: number
  remaining_seconds: number
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
    const countdown = window.setInterval(() => {
      if (document.visibilityState === 'visible') setRemaining((value) => Math.max(0, value - 1))
    }, 1000)
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
  }, [access.access_status, onHeartbeat, onResume])

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
            ? 'Your two active lesson hours have been used. This lesson is now closed.'
            : 'Your remaining lesson time is saved if you leave or pause.'}
      </small>
    </aside>
  )
}
