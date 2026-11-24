import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { academyBackendOrigin } from '../lib/academyApi'

export type MediaBundle = { files: Record<string, string>; expiresAt: string; introductions?: { original?: string; revised?: string } }
export type PhaseTwoMediaAccess = {
  private: boolean
  introductions?: MediaBundle['introductions']
  resolve: (url: string | undefined) => string | undefined
  json: (url: string) => Promise<any>
}
export const publicPhaseTwoMedia: PhaseTwoMediaAccess = {
  private: false,
  resolve: url => url,
  json: async url => { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('Media unavailable'); return r.json() },
}
export function privateMediaAccess(bundle: MediaBundle): PhaseTwoMediaAccess {
  const resolve = (url: string | undefined) => {
    if (!url) return undefined
    try { return bundle.files[new URL(url, window.location.origin).pathname] } catch { return undefined }
  }
  return { private: true, introductions: bundle.introductions, resolve, json: async url => {
    const signed = resolve(url)
    if (!signed) throw new Error('Media unavailable')
    const response = await fetch(signed, { cache: 'no-store' })
    if (!response.ok) throw new Error('Media unavailable')
    return response.json()
  } }
}

export async function requestPhaseTwoMedia(lessonId: string, enrollmentId?: string, signal?: AbortSignal, captionsOnly = false): Promise<MediaBundle> {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Please sign in to load your lesson.')
  const query = enrollmentId ? '?enrollment=' + encodeURIComponent(enrollmentId) : ''
  const response = await fetch(`${academyBackendOrigin()}/api/learner/${captionsOnly ? 'phase-two-captions' : 'phase-two-media'}/${encodeURIComponent(lessonId)}${query}`, {
    headers: { 'X-ACA-Access-Token': data.session.access_token }, cache: 'no-store', signal,
  })
  if (!response.ok) throw new Error('Your lesson recordings could not be loaded. Please try again.')
  const bundle = await response.json() as MediaBundle
  if (!bundle.files || !Object.keys(bundle.files).length || !Number.isFinite(Date.parse(bundle.expiresAt)) || Date.parse(bundle.expiresAt) <= Date.now() ||
      Object.values(bundle.files).some(url => typeof url !== 'string' || !url.startsWith('https://'))) throw new Error('Your lesson recordings are temporarily unavailable.')
  return bundle
}

// Authenticated delivery is activated only with the coordinated storage/hosting release.
export function PhaseTwoPrivateMedia({ lessonId, enrollmentId, children }: {
  lessonId?: string; enrollmentId?: string; children: (access: PhaseTwoMediaAccess) => ReactNode
}) {
  if (import.meta.env.VITE_ACA_PRIVATE_PHASE_TWO_MEDIA !== 'true') return children(publicPhaseTwoMedia)
  return <ProtectedMedia key={`${enrollmentId || 'owner'}:${lessonId}`} lessonId={lessonId} enrollmentId={enrollmentId}>{children}</ProtectedMedia>
}

function ProtectedMedia({ lessonId, enrollmentId, children }: {
  lessonId?: string; enrollmentId?: string; children: (access: PhaseTwoMediaAccess) => ReactNode
}) {
  const [bundle, setBundle] = useState<MediaBundle | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<string, { time: number; playing: boolean }>())
  const rememberPlayback = () => {
    root.current?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media => {
      if (media.getAttribute('src')) positions.current.set(media.getAttribute('aria-label') || '', { time: media.currentTime, playing: !media.paused })
    })
  }
  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    let generation = 0
    const load = async () => {
      const requestGeneration = ++generation
      try {
        if (!lessonId) throw new Error('This lesson could not be identified. Return to your lessons and try again.')
        const next = await requestPhaseTwoMedia(lessonId, enrollmentId, controller.signal)
        if (cancelled || requestGeneration !== generation) return
        rememberPlayback()
        setBundle(next); setError('')
        // Renew without opening a lesson, changing its clock, or remounting its work.
        timer = setTimeout(() => { void load() }, Math.max(1000, Date.parse(next.expiresAt) - Date.now() - 30000))
      } catch (e) {
        if (!cancelled && requestGeneration === generation) {
          rememberPlayback()
          root.current?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media => media.pause())
          // Remove access to every recording while keeping the mounted work form.
          // A failed renewal must not discard a learner's unsaved project notes.
          setBundle(current => current ? { ...current, files: {} } : null)
          setError(e instanceof Error ? e.message : 'Lesson media is unavailable.')
        }
      }
    }
    void load()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        generation++; clearTimeout(timer)
        root.current?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media => media.pause())
        setBundle(null); setError('Please sign in to load your lesson.')
      }
    })
    return () => { cancelled = true; generation++; controller.abort(); clearTimeout(timer); data.subscription.unsubscribe() }
  }, [lessonId, enrollmentId, attempt])
  return <div ref={root} onLoadedMetadataCapture={event => {
    const media = event.target
    if (!(media instanceof HTMLMediaElement)) return
    const key = media.getAttribute('aria-label') || '', previous = positions.current.get(key)
    if (!previous) return
    positions.current.delete(key)
    if (Number.isFinite(previous.time)) media.currentTime = previous.time
    if (previous.playing) void media.play().catch(() => {})
  }}>
    {error && <section role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Try loading recordings again</button></section>}
    {bundle ? children(privateMediaAccess(bundle)) : !error && <p role="status">Loading your lesson recordings…</p>}
  </div>
}
