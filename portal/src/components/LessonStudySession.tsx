import { useEffect, useRef, useState, type ReactNode } from 'react'
import { pauseStudyOnExit, requestStudySession, type StudySession } from '../lib/lessonStudy'
import './lessonStudySession.css'

const IDLE_MS = 5 * 60_000
const WARNING_MS = 30_000
const isHidden = () => document.visibilityState === 'hidden'

export type LessonStudySessionProps = {
  enrollmentId?: string
  lessonId: string
  children: ReactNode
  onClosed?: () => void
  onResume?: () => Promise<void>
  onRemaining?: (seconds: number) => void
}

export function LessonStudySession(props: LessonStudySessionProps) {
  if (!props.enrollmentId) return <>{props.children}</>
  return <ActiveStudySession {...props} enrollmentId={props.enrollmentId} />
}

function ActiveStudySession({ enrollmentId, lessonId, children, onClosed, onResume, onRemaining }: LessonStudySessionProps & { enrollmentId: string }) {
  const [session, setSession] = useState<StudySession | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('Checking your saved lesson time…')
  const [warning, setWarning] = useState(false)
  const content = useRef<HTMLDivElement>(null)
  const state = useRef<StudySession | null>(null)
  const pending = useRef(false)
  const active = useRef(true)
  const generation = useRef(0)
  const mediaPositions = useRef(new Map<HTMLMediaElement, number>())
  const checkpoint = useRef(0)
  const lastInteraction = useRef(0)
  const callbacks = useRef({ onClosed, onResume, onRemaining })
  callbacks.current = { onClosed, onResume, onRemaining }

  const freezeMedia = () => content.current?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media => { mediaPositions.current.set(media, media.currentTime); media.pause() })
  const apply = (next: StudySession) => {
    state.current = next
    checkpoint.current = performance.now()
    if (!active.current) return
    setSession(next); setRemaining(next.remaining_seconds)
    callbacks.current.onRemaining?.(next.remaining_seconds)
    if (next.access_status !== 'active') {
      freezeMedia()
      setMessage(next.access_status === 'superseded' ? 'This lesson was opened in another window. Resume here to continue.' : 'Your lesson study time has ended. Your saved work remains available.')
      if (next.access_status === 'expired') callbacks.current.onClosed?.()
    }
  }

  const pause = async (reason = 'Your lesson is paused. Your unused study time is saved.') => {
    if (state.current?.study_state !== 'running') return
    freezeMedia()
    const token = state.current.study_token
    const epoch = generation.current
    state.current = { ...state.current, study_state: 'paused' }
    setSession(state.current); setWarning(false); setMessage(reason)
    // Do not queue a pause behind a heartbeat: server row locks and tokens make
    // both arrival orders safe, including a late response from the old request.
    try {
      const next = await requestStudySession(enrollmentId, lessonId, 'pause', token)
      if (active.current && epoch === generation.current && state.current?.study_token === token) apply(next)
    } catch { pauseStudyOnExit(enrollmentId, lessonId, token) }
  }

  const resume = async (refreshMedia = true) => {
    if (pending.current) return
    const epoch = generation.current
    pending.current = true; setBusy(true); setWarning(false)
    try {
      if (refreshMedia) await callbacks.current.onResume?.()
      if (isHidden() || !navigator.onLine) {
        setMessage('Return to this lesson with a connection to resume your saved time.'); return
      }
      const next = await requestStudySession(enrollmentId, lessonId, 'start', null)
      if (!active.current || epoch !== generation.current) { pauseStudyOnExit(enrollmentId, lessonId, next.study_token); return }
      lastInteraction.current = performance.now(); apply(next); setMessage('')
      if (isHidden() || !navigator.onLine) void pause('Your lesson is paused. Resume when you return.')
    } catch (error) {
      if (active.current && epoch === generation.current) setMessage(error instanceof Error ? error.message : 'Your lesson is paused. Please try again.')
    } finally { if (epoch === generation.current) { pending.current = false; if (active.current) setBusy(false) } }
  }

  useEffect(() => {
    active.current = true
    generation.current++
    pending.current = false
    state.current = null
    lastInteraction.current = performance.now()
    void resume(false)
    const interact = () => { lastInteraction.current = performance.now(); setWarning(false) }
    const exit = () => {
      const current = state.current
      if (current?.study_state === 'running') {
        freezeMedia(); state.current = { ...current, study_state: 'paused' }
        setSession(state.current); setMessage('Your lesson is paused. Resume when you return.'); setWarning(false)
        pauseStudyOnExit(enrollmentId, lessonId, current.study_token)
      }
    }
    const visibility = () => { if (document.visibilityState === 'hidden') exit() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', exit)
    window.addEventListener('offline', exit)
    const restoreMediaPosition = (event: Event) => {
      const media = event.target as HTMLMediaElement
      const position = mediaPositions.current.get(media)
      if (position !== undefined && Number.isFinite(position)) {
        try { media.currentTime = position } catch { /* The recording may not yet be seekable. */ }
      }
    }
    const element = content.current
    element?.addEventListener('loadedmetadata', restoreMediaPosition, true)
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart']
    for (const event of events) element?.addEventListener(event, interact, { passive: true, capture: true })
    const tick = window.setInterval(() => {
      const current = state.current
      if (!current || current.study_state !== 'running' || current.access_status !== 'active') return
      const now = performance.now()
      const elapsed = Math.max(0, (now - checkpoint.current) / 1000)
      const hardRemaining = current.limit_at ? (Date.parse(current.limit_at) - Date.now()) / 1000 : Infinity
      const seconds = Math.max(0, Math.ceil(Math.min(current.remaining_seconds - elapsed, hardRemaining)))
      setRemaining(seconds); callbacks.current.onRemaining?.(seconds)
      const playing = [...(content.current?.querySelectorAll<HTMLMediaElement>('video,audio') ?? [])].some(media => !media.paused && !media.ended)
      if (playing) lastInteraction.current = now
      const idle = now - lastInteraction.current
      setWarning(idle >= IDLE_MS - WARNING_MS)
      if (idle >= IDLE_MS) void pause('Your lesson paused after inactivity. Your unused study time is saved.')
      if (!seconds) {
        // Hide teaching immediately at the displayed boundary, including when
        // a network request is still outstanding. Only the server can reopen it.
        freezeMedia()
        state.current = { ...current, study_state: 'paused' }
        setSession(state.current); setWarning(false)
        setMessage('Checking your saved lesson time. Your work is preserved.')
        void requestStudySession(enrollmentId, lessonId, 'heartbeat', current.study_token)
          .then(next => {
            if (active.current && state.current?.study_token === current.study_token) apply(next)
          }).catch(() => { if (active.current) setMessage('Your lesson is paused. Reconnect and resume to check your saved time.') })
      }
    }, 1000)
    const check = async () => {
      const current = state.current
      if (pending.current || current?.study_state !== 'running') return
      pending.current = true
      try {
        const next = await requestStudySession(enrollmentId, lessonId, 'heartbeat', current.study_token)
        if (active.current && state.current?.study_state === 'running' && state.current.study_token === current.study_token) apply(next)
      } catch {
        if (active.current) await pause('The connection was interrupted. Your lesson time is paused; reconnect and resume.')
      } finally { pending.current = false }
    }
    const heartbeat = window.setInterval(() => { void check() }, 30_000)
    return () => {
      active.current = false
      generation.current++
      const current = state.current
      if (current?.study_state === 'running') pauseStudyOnExit(enrollmentId, lessonId, current.study_token)
      clearInterval(tick); clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', exit); window.removeEventListener('offline', exit)
      for (const event of events) element?.removeEventListener(event, interact, true)
      element?.removeEventListener('loadedmetadata', restoreMediaPosition, true)
    }
  }, [enrollmentId, lessonId])

  const running = !busy && session?.study_state === 'running' && session.access_status === 'active'
  return <section className="lesson-study-session" aria-label="Lesson study session">
    <aside className="lesson-study-clock">
      <span>{session?.study_mode === 'budget' ? 'Study time remaining' : 'Extended access remaining'}</span>
      <strong role="timer">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong>
      {running ? <button type="button" onClick={() => { void pause() }}>Pause lesson</button> : null}
    </aside>
    {warning && running ? <div role="alert" className="lesson-study-notice">Are you still studying? Your lesson will pause shortly to protect your remaining time. <button onClick={() => { lastInteraction.current = performance.now(); setWarning(false) }}>Keep studying</button></div> : null}
    {!running ? <div className="lesson-study-notice" role="status"><p>{message || 'Your lesson is paused. Your unused study time is saved.'}</p><button type="button" disabled={busy || session?.access_status === 'expired'} onClick={() => { void resume() }}>{busy ? 'Checking lesson time…' : 'Resume lesson'}</button></div> : null}
    <div ref={content} hidden={!running} inert={!running}>{children}</div>
  </section>
}
