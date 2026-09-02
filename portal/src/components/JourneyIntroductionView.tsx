import type { JourneyIntroduction } from '../types'

type JourneyIntroductionViewProps = {
  introduction: JourneyIntroduction
  mediaUrl: string | null
  captionUrl: string | null
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
  onBack,
  onContinue,
}: JourneyIntroductionViewProps) {
  const { content } = introduction

  return (
    <main className="lesson-main introduction-main">
      <button className="back-link" type="button" onClick={onBack}>
        ← Back to learning home
      </button>

      <article className="introduction-article">
        <header className="introduction-hero">
          <div>
            <p className="eyebrow">{content.eyebrow}</p>
            <h1>{content.title}</h1>
            <p>{content.lead}</p>
          </div>
          <span>{formatDuration(introduction.duration_seconds)}</span>
        </header>

        {mediaUrl ? (
          <section className="introduction-media" aria-labelledby="welcome-media-heading">
            <h2 id="welcome-media-heading">Journey welcome</h2>
            {introduction.media_kind === 'video' ? (
              <video controls preload="metadata">
                <source src={mediaUrl} />
                {captionUrl ? (
                  <track kind="captions" src={captionUrl} srcLang="en" label="English" default />
                ) : null}
                Your browser does not support the video player. Use the transcript below.
              </video>
            ) : (
              <audio controls preload="metadata" src={mediaUrl}>
                Your browser does not support the audio player. Use the transcript below.
              </audio>
            )}
          </section>
        ) : null}

        <section className="introduction-outcomes" aria-labelledby="welcome-outcomes-heading">
          <p className="eyebrow">Before you begin</p>
          <h2 id="welcome-outcomes-heading">What this welcome will prepare you to do</h2>
          <ul>
            {content.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
          </ul>
        </section>

        <section aria-labelledby="journey-roadmap-heading">
          <p className="eyebrow">Your roadmap</p>
          <h2 id="journey-roadmap-heading">Six steady steps through Journey 1</h2>
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

        <section className="transcript-panel">
          <details>
            <summary>Read the complete transcript</summary>
            <div className="transcript-copy">
              {content.transcript.map((segment, index) => (
                <p key={`${segment.timecode ?? 'segment'}-${index}`}>
                  {segment.timecode ? <time>{segment.timecode}</time> : null}
                  {segment.text}
                </p>
              ))}
            </div>
          </details>
        </section>

        <footer className="introduction-next">
          <p>{content.closing}</p>
          <button type="button" onClick={onContinue}>Continue to Lesson 1.1</button>
        </footer>
      </article>
    </main>
  )
}
