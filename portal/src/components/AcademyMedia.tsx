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
  if (kind === 'video') return <AcademyVideo src={src} label={label} poster={poster} captionUrl={captionUrl} />
  return <AcademyAudio src={src} label={label} captionUrl={captionUrl} />
}

function formatTime(value: number) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function AcademyVideo({ src, label, poster, captionUrl }: Omit<AcademyMediaProps, 'kind'>) {
  const mediaRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const previousVolume = useRef(.8)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(.8)

  useEffect(() => () => { void audioContextRef.current?.close() }, [])

  async function prepareAudio() {
    const media = mediaRef.current
    if (!media || typeof AudioContext === 'undefined') return
    if (!audioContextRef.current) {
      const context = new AudioContext({ latencyHint: 'playback' })
      const sourceNode = context.createMediaElementSource(media)
      const gainNode = context.createGain()
      sourceNode.connect(gainNode).connect(context.destination)
      gainNode.gain.value = volume
      audioContextRef.current = context
      audioSourceRef.current = sourceNode
      gainRef.current = gainNode
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume()
  }

  async function togglePlayback() {
    const media = mediaRef.current
    if (!media) return
    try {
      await prepareAudio()
      if (media.paused) await media.play()
      else media.pause()
    } catch {
      setFailed(true)
    }
  }

  function changeVolume(next: number) {
    const normalized = Math.min(1, Math.max(0, next))
    if (normalized > 0) previousVolume.current = normalized
    setVolume(normalized)
    if (gainRef.current) gainRef.current.gain.value = normalized
  }

  function toggleSound() {
    changeVolume(volume === 0 ? previousVolume.current : 0)
  }

  return <div className="academy-media academy-media--video academy-video" style={{ maxWidth: 640 }}>
    <video
      ref={mediaRef}
      src={src}
      poster={poster}
      preload="metadata"
      playsInline
      crossOrigin="anonymous"
      aria-label={label}
      onPlay={() => { setPlaying(true); setFailed(false) }}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
      onDurationChange={event => setDuration(event.currentTarget.duration)}
      onError={() => setFailed(true)}
    >
      {captionUrl ? <track kind="captions" src={captionUrl} srcLang="en" label="English" default /> : null}
      Your browser does not support video playback.
    </video>
    <div className="academy-video-controls">
      <button type="button" className="academy-video-play" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}>
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
        <span>{playing ? 'Pause' : 'Play'}</span>
      </button>
      <label className="academy-video-position">
        <span>Video position</span>
        <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={event => {
          const next = Number(event.currentTarget.value)
          if (mediaRef.current) mediaRef.current.currentTime = next
          setCurrentTime(next)
        }} />
      </label>
      <output aria-label="Video time">{formatTime(currentTime)} / {formatTime(duration)}</output>
      <button type="button" className="academy-video-sound" onClick={toggleSound} aria-label={volume === 0 ? 'Turn sound on' : 'Mute sound'}>
        {volume === 0 ? 'Sound on' : 'Mute'}
      </button>
      <label className="academy-video-volume">
        <span>Sound</span>
        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => changeVolume(Number(event.currentTarget.value))} />
      </label>
    </div>
    {failed ? <div role="alert" className="academy-media-error"><p>This recording could not play. Please try again.</p></div> : null}
  </div>
}

function AcademyAudio({ src, label, captionUrl }: Omit<AcademyMediaProps, 'kind' | 'poster'>) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!host.current) return
    setFailed(false)
    // Plyr owns this subtree. React owns only the host and error message.
    const stage = document.createElement('div')
    const media = document.createElement('audio')
    media.controls = true
    media.preload = 'metadata'
    media.setAttribute('aria-label', label)
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
    let audibleVolume = 1
    const onVolumeChange = () => {
      if (media.volume > 0) audibleVolume = media.volume
    }
    media.addEventListener('error', onError)
    media.addEventListener('playing', onPlaying)
    media.addEventListener('volumechange', onVolumeChange)
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
      listeners: {
        mute: () => {
          // Plyr shows the mute icon at zero volume too. An explicit unmute
          // must restore audible volume, not only flip the muted property.
          if (media.volume !== 0) return true
          media.volume = audibleVolume
          media.muted = false
          return false
        },
      },
      controls: ['play', 'progress', 'current-time', 'mute', 'volume'],
      captions: { active: Boolean(captionUrl), language: 'en' },
    })
    return () => {
      media.removeEventListener('error', onError)
      media.removeEventListener('playing', onPlaying)
      media.removeEventListener('volumechange', onVolumeChange)
      player.destroy()
      stage.remove()
    }
  }, [src, label, captionUrl, attempt])

  return <div className="academy-media academy-media--audio">
    <div ref={host} />
    {failed ? <div role="alert" className="academy-media-error">
      <p>This recording could not play. Please try again.</p>
      <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </div> : null}
  </div>
}
