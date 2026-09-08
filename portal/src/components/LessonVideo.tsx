import { useRef, useState } from 'react'

export function LessonVideo({ src, label, poster, captions }: {
  src: string; label: string; poster?: string; captions?: string | null
}) {
  const [opened, setOpened] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  // Refresh only our own endpoints; never modify an external signed URL.
  const source = attempt && src.startsWith('/') ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}` : src
  return <div style={{ maxWidth: 640, margin: '0 auto 1rem' }}>
    {!opened ? <button type="button" onClick={() => setOpened(true)} aria-label={`Watch ${label}`}>
      <span aria-hidden="true">▶ </span>Watch video
    </button> : <>
      <video key={`${src}:${attempt}`} ref={video} controls playsInline preload="auto"
        src={source} poster={poster} aria-label={label}
        crossOrigin={captions ? 'anonymous' : undefined}
        style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 640 }}
        onLoadedMetadata={() => {
          if (video.current) { video.current.muted = false; video.current.volume = 1 }
        }}
        onError={() => setFailed(true)}>
        {captions ? <track kind="captions" src={captions} srcLang="en" label="English" default /> : null}
        Your browser does not support video playback.
      </video>
      {failed ? <p role="alert">The video could not load. <button type="button" onClick={() => {
        setFailed(false); setAttempt(value => value + 1)
      }}>Reload video</button></p> : null}
    </>}
  </div>
}
