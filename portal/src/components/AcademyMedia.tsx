import { useEffect, useRef, useState } from 'react'
import Plyr from '../vendor/plyr/plyr.mjs'
import iconUrl from '../vendor/plyr/plyr.svg?url'
import '../vendor/plyr/plyr.css'
import './AcademyMedia.css'

type AcademyMediaProps = {
  kind: 'video' | 'audio'
  src: string
  label: string
  poster?: string
  captionUrl?: string | null
}

export function AcademyMedia({ kind, src, label, poster, captionUrl }: AcademyMediaProps) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!host.current) return
    setFailed(false)
    // Plyr owns this subtree. React owns only the host and error message.
    const stage = document.createElement('div')
    const media = document.createElement(kind)
    media.controls = true
    media.preload = 'metadata'
    media.setAttribute('aria-label', label)
    if (kind === 'video') {
      media.setAttribute('playsinline', '')
      if (poster) media.setAttribute('poster', poster)
    }
    if (captionUrl) {
      media.crossOrigin = 'anonymous'
      const track = document.createElement('track')
      track.kind = 'captions'
      track.src = captionUrl
      track.srclang = 'en'
      track.label = 'English'
      track.default = true
      media.append(track)
    }
    const onError = () => setFailed(true)
    const onPlaying = () => setFailed(false)
    media.addEventListener('error', onError)
    media.addEventListener('playing', onPlaying)
    // Keep the authorized source URL, including its existing access control.
    media.src = src
    stage.append(media)
    host.current.append(stage)
    const player = new Plyr(media, {
      iconUrl,
      loadSprite: true,
      autoplay: false,
      muted: false,
      volume: 1,
      storage: { enabled: false },
      controls: kind === 'video'
        ? ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'fullscreen']
        : ['play', 'progress', 'current-time', 'mute', 'volume'],
      captions: { active: Boolean(captionUrl), language: 'en' },
    })
    return () => {
      media.removeEventListener('error', onError)
      media.removeEventListener('playing', onPlaying)
      player.destroy()
      stage.remove()
    }
  }, [kind, src, label, poster, captionUrl, attempt])

  return <div className={`academy-media academy-media--${kind}`} style={kind === 'video' ? { maxWidth: 640 } : undefined}>
    <div ref={host} />
    {failed ? <div role="alert" className="academy-media-error">
      <p>This recording could not play. Please try again.</p>
      <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </div> : null}
  </div>
}
