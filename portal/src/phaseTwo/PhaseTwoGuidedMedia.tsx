import { useRef, useState } from 'react'
import './phaseTwoGuidedMedia.css'

export type GuidedAudioChapter = {
  title: string
  start_seconds: number
  transcript: string
}

export type GuidedInstructionMedia = {
  url: string
  duration_seconds: number
  chapters: GuidedAudioChapter[]
  voice_id?: string
  approvalStatus: 'founder_approved' | 'founder_review_pending'
}

export type VisualDemoClip = {
  key: string
  title: string
  url: string
  captions_url: string
  transcript: string
  duration_seconds: number
  fictional_training_example: true
}

export function PhaseTwoGuidedAudio({ lessonId, media }: {
  lessonId: string
  media: GuidedInstructionMedia
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const chapters = media.chapters
  const playingChapter = chapters.reduce((index, chapter, i) =>
    currentTime >= chapter.start_seconds ? i : index, 0)
  const viewedChapter = selectedChapter ?? playingChapter

  function selectChapter(index: number) {
    const player = audioRef.current
    if (!player) return
    player.currentTime = chapters[index].start_seconds
    setCurrentTime(player.currentTime)
    setSelectedChapter(index)
    void player.play().catch(() => {
      // The chapter remains selected if the browser requires a second explicit play.
    })
  }

  return (
    <section className="p2-guided-audio" aria-labelledby="p2-guided-audio-heading">
      <div className="p2-guided-media-head">
        <span className="p2-guided-medallion" aria-hidden="true">♫</span>
        <div>
          <p className="eyebrow">Listen · Think · Practice</p>
          <h2 id="p2-guided-audio-heading">Guided instruction</h2>
          <p>Four focused teaching chapters from your Academy instructor. Pause whenever you need to examine the example or write a decision note.</p>
        </div>
      </div>
      <audio
        controls
        preload="auto"
        ref={audioRef}
        src={media.url}
        aria-label={`Lesson ${lessonId} guided instruction audio`}
        onTimeUpdate={event => { setCurrentTime(event.currentTarget.currentTime); setSelectedChapter(null) }}
      >
        Your browser does not support audio playback.
      </audio>
      <h3 className="p2-guided-chapters-heading">Follow the lesson</h3>
      <div className="p2-guided-chapters" role="group" aria-label="Guided instruction chapters">
        {chapters.map((chapter, i) => (
          <button type="button" key={chapter.title}
            aria-pressed={viewedChapter === i}
            onClick={() => selectChapter(i)}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <strong>{chapter.title}</strong>
          </button>
        ))}
      </div>
      <details className="p2-guided-transcript">
        <summary>Read the guided instruction transcript</summary>
        <h3>{chapters[viewedChapter]?.title}</h3>
        {chapters[viewedChapter]?.transcript.split('\n\n').map((paragraph, i) =>
          <p key={i}>{paragraph}</p>)}
      </details>
    </section>
  )
}

/** Each short clip uses the same confirmed instructor voice and a clearly fictional report. */
export function PhaseTwoDemoClips({ clips }: { clips: VisualDemoClip[] }) {
  const [selected, setSelected] = useState(0)
  const [caption, setCaption] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const current = clips[selected]
  if (!current) return null

  function chooseClip(index: number) {
    const player = videoRef.current
    setSelected(index)
    setCaption('')
    if (!player) return
    player.pause()
    player.src = clips[index].url
    player.load()
    // A direct user click starts playback with sound. Native controls remain
    // available for pausing and replay. If browser policy blocks audio, leave
    // the player ready for an explicit Play gesture; never silently mute it.
    void player.play().catch(() => {})
  }

  function updateCaption(player: HTMLVideoElement) {
    const active = player.textTracks[0]?.activeCues
    setCaption(active ? Array.from(active).map(cue => (cue as VTTCue).text).join(' ') : '')
  }

  return (
    <section className="p2-demo-clips" aria-labelledby="p2-demo-clips-heading">
      <div className="p2-demo-clips-header">
        <p className="eyebrow">Watch the decisions happen</p>
        <h3 id="p2-demo-clips-heading">A case you can examine, step by step</h3>
        <p>Four narrated demonstrations. The business example is fictional—not a recording of a live customer's experience.</p>
      </div>
      <div className="p2-demo-clip-tabs" role="group" aria-label="Choose a screen demonstration">
        {clips.map((clip, i) => <button type="button" key={clip.key}
          aria-pressed={selected === i} onClick={() => chooseClip(i)}>
          <span>{String(i + 1).padStart(2, '0')}</span><strong>{clip.title}</strong>
        </button>)}
      </div>
      <div className="p2-demo-clip-player">
        <h4>{current.title}</h4>
        <video ref={videoRef} controls playsInline preload="auto"
          src={clips[0].url} aria-label={current.title + ' screen demonstration'}
          onTimeUpdate={e => updateCaption(e.currentTarget)}
          onEnded={() => setCaption('')}>
          <track kind="metadata" src={current.captions_url} srcLang="en" label="Narration below video" default />
          <track kind="captions" src={current.captions_url} srcLang="en" label="Optional captions inside video" />
          Your browser does not support video playback.
        </video>
        <div className="p2-demo-caption-strip" role="status" aria-live="off"
          style={{ background: '#102d4f', color: '#fff', padding: '0.8rem 1rem',
            minHeight: '3.5rem', textAlign: 'center', fontSize: '1rem', lineHeight: 1.5 }}>
          {caption || 'Narration appears here below the video while it plays.'}
        </div>
        <details>
          <summary>Read this demonstration</summary>
          <p>{current.transcript}</p>
        </details>
        <p className="p2-demo-case-note">Illustrated fictional case · Apply the same verification steps with your chosen AI tool.</p>
      </div>
    </section>
  }
