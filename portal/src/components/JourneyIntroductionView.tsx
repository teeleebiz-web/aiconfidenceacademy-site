import type { JourneyIntroduction } from '../types'

type JourneyIntroductionViewProps = {
  introduction: JourneyIntroduction
  mediaUrl: string | null
  captionUrl: string | null
  companionAudioUrl?: string | null
  companionCaptionUrl?: string | null
  onBack: () => void
  onContinue: () => void
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function JourneyIntroductionView({
  introduction,
  mediaUrl,
  captionUrl,
  companionAudioUrl = null,
  companionCaptionUrl = null,
  onBack,
  onContinue,
}: JourneyIntroductionViewProps) {
  const { content } = introduction
  const firstLessonId = content.roadmap[0]?.page_id ?? ''
  const journeyNumber = firstLessonId.split('.')[0] || 'this'

  return (
    <main className="lesson-main introduction-main">
      <button className="back-link" type="button" onClick={onBack}>
        ← Back to learning home
      </button>

      {introduction.status === 'draft' ? (
        <aside className="lesson-review-banner" aria-label="Owner review notice">
          <strong>Owner review · Unpublished journey welcome</strong>
          <span>This draft is visible only through protected review access.</span>
        </aside>
      ) : null}

      <article className="introduction-article">
        <header className="introduction-hero">
          <div>
            <p className="eyebrow">{content.eyebrow}</p>
            <h1>{content.title}</h1>
            <p>{content.lead}</p>
          </div>
          <span>{formatDuration(introduction.duration_seconds)}</span>
        </header>

        <section className="introduction-media" aria-labelledby="welcome-media-heading">
          <p className="eyebrow">Branded Journey introduction</p>
          <h2 id="welcome-media-heading">Meet the Journey before the lesson begins</h2>
          <p className="media-stage-lead">
            Begin with Terrence's human welcome, then listen to Knowledge's guided orientation.
          </p>
          <div className="media-stage-grid">
            <article className="media-stage-card">
              <header>
                <span aria-hidden="true">01</span>
                <div>
                  <small>Founder/avatar video · about 1 minute</small>
                  <h3>Terrence welcomes you</h3>
                </div>
              </header>
              {mediaUrl && introduction.media_kind === 'video' ? (
                <video controls preload="metadata" crossOrigin="anonymous">
                  <source src={mediaUrl} />
                  {captionUrl ? (
                    <track kind="captions" src={captionUrl} srcLang="en" label="English" default />
                  ) : null}
                  Your browser does not support the video player. Use the transcript below.
                </video>
              ) : (
                <div className="media-placeholder" role="status">
                  <strong>Production placeholder</strong>
                  <span>The founder/avatar welcome will be installed here after approval.</span>
                </div>
              )}
            </article>

            <article className="media-stage-card">
              <header>
                <span aria-hidden="true">02</span>
                <div>
                  <small>Companion audio · about 4 minutes</small>
                  <h3>Knowledge previews the learning</h3>
                </div>
              </header>
              {companionAudioUrl ? (
                <audio controls preload="metadata" crossOrigin="anonymous">
                  <source src={companionAudioUrl} />
                  {companionCaptionUrl ? (
                    <track kind="captions" src={companionCaptionUrl} srcLang="en" label="English" default />
                  ) : null}
                  Your browser does not support the audio player. Use the transcript below.
                </audio>
              ) : (
                <div className="media-placeholder" role="status">
                  <strong>Production placeholder</strong>
                  <span>The Knowledge companion audio will be installed here after approval.</span>
                </div>
              )}
            </article>
          </div>
        </section>

        <section className="introduction-outcomes" aria-labelledby="welcome-outcomes-heading">
          <p className="eyebrow">Before you begin</p>
          <h2 id="welcome-outcomes-heading">What this welcome will prepare you to do</h2>
          <ul>
            {content.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
          </ul>
        </section>

        <section aria-labelledby="journey-roadmap-heading">
          <p className="eyebrow">Your roadmap</p>
          <h2 id="journey-roadmap-heading">Six steady steps through Journey {journeyNumber}</h2>
          <ol className="roadmap-list">
            {content.roadmap.map((item) => (
              <li key={item.page_id}>
                <span>{item.page_id}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.purpose}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="transcript-panel" aria-labelledby="transcript-heading">
          <p className="eyebrow">Accessible from the beginning</p>
          <h2 id="transcript-heading">Read either introduction</h2>
          <div className="transcript-grid">
            <TranscriptDetails
              title="Founder/avatar welcome transcript"
              segments={content.avatar_transcript ?? (content.audio_transcript ? [] : content.transcript)}
            />
            <TranscriptDetails
              title="Knowledge companion-audio transcript"
              segments={content.audio_transcript ?? []}
            />
          </div>
        </section>

        <footer className="introduction-next">
          <p>{content.closing}</p>
          <button type="button" onClick={onContinue}>
            {firstLessonId ? `Continue to Lesson ${firstLessonId}` : 'Continue to the first lesson'}
          </button>
        </footer>
      </article>
    </main>
  )
}

function TranscriptDetails({ title, segments }: { title: string; segments: JourneyIntroduction['content']['transcript'] }) {
  return (
    <details>
      <summary>{title}</summary>
      <div className="transcript-copy">
        {segments.length ? segments.map((segment, index) => (
          <p key={`${segment.timecode ?? 'segment'}-${index}`}>
            {segment.timecode ? <time>{segment.timecode}</time> : null}
            {segment.speaker ? <strong>{segment.speaker}</strong> : null}
            {segment.text}
          </p>
        )) : (
          <p>The approved transcript will appear here with the finished recording.</p>
        )}
      </div>
    </details>
  )
}
