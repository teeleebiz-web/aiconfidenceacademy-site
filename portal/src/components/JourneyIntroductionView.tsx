import { LessonVideo } from './LessonVideo'
import type { JourneyIntroduction } from '../types'

type JourneyIntroductionViewProps = {
  introduction: JourneyIntroduction
  mediaUrl: string | null
  captionUrl: string | null
  companionAudioUrl?: string | null
  companionCaptionUrl?: string | null
  onBack: () => void
  hideBack?: boolean
  onContinue: () => void
}

export function JourneyIntroductionView({
  introduction,
  mediaUrl,
  captionUrl,
  companionAudioUrl = null,
  companionCaptionUrl = null,
  onBack,
  hideBack = false,
  onContinue,
}: JourneyIntroductionViewProps) {
  const { content } = introduction
  const firstLessonId = content.roadmap[0]?.page_id ?? ''
  const journeyNumber = firstLessonId.split('.')[0] || 'this'
  const singleVideo = content.presentation === 'single_video'

  return (
    <main className="lesson-main introduction-main">
      {!singleVideo && !hideBack ? <button className="back-link" type="button" onClick={onBack}>
        ← Back to learning home
      </button> : null}

      {!singleVideo && introduction.status === 'draft' ? (
        <aside className="lesson-review-banner" aria-label="Owner review notice">
          <strong>Owner review · Unpublished journey welcome</strong>
          <span>This draft is visible only through protected review access.</span>
        </aside>
      ) : null}

      <article className={`introduction-article${singleVideo ? ' single-video-introduction' : ''}`}>
        <header className={singleVideo ? 'lesson-hero' : 'introduction-hero'}>
          <div>
            <p className="eyebrow">{content.eyebrow}</p>
            <h1>{content.title}</h1>
            <p>{content.lead}</p>
          </div>
        </header>

        {singleVideo ? (
          <section className="practice-panel" aria-labelledby="welcome-media-heading">
            <h2 id="welcome-media-heading">Welcome to Journey {journeyNumber}</h2>
            {mediaUrl && introduction.media_kind === 'video' ? (
              <LessonVideo key={mediaUrl} src={mediaUrl} label={`Journey ${journeyNumber} welcome video`} poster={content.poster_url} captions={captionUrl} />
            ) : (
              <div className="welcome-video-placeholder">
                {content.poster_url ? <img src={content.poster_url} alt={content.poster_alt ?? 'Your ACA instructor'} /> : null}
                <p>Video will be available here.</p>
              </div>
            )}
            <TranscriptDetails title="Read the journey introduction" segments={content.transcript} />
          </section>
        ) : <section className="introduction-media" aria-labelledby="welcome-media-heading">
          <p className="eyebrow">Video and audio</p>
          <h2 id="welcome-media-heading">Start Journey {journeyNumber}</h2>
          <p className="media-stage-lead">
            Watch the video for an introduction to this journey.
          </p>
          <div className="media-stage-grid">
            <article className="media-stage-card">
              <header>
                <span aria-hidden="true">01</span>
                <div>
                  <small>Video</small>
                  <h3>Journey {journeyNumber} welcome video</h3>
                </div>
              </header>
              {mediaUrl && introduction.media_kind === 'video' ? (
                <LessonVideo key={mediaUrl} src={mediaUrl} label={`Journey ${journeyNumber} welcome video`} captions={captionUrl} />
              ) : (
                <div className="media-placeholder" role="status">
                  <strong>Video coming soon</strong>
                  <span>The video will introduce this journey.</span>
                </div>
              )}
            </article>

            <article className="media-stage-card">
              <header>
                <span aria-hidden="true">02</span>
                <div>
                  <small>Audio</small>
                  <h3>Journey overview</h3>
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
                  <strong>Audio coming soon</strong>
                  <span>An audio overview of this journey will be available here.</span>
                </div>
              )}
            </article>
          </div>
        </section>}

        <section className="introduction-outcomes" aria-labelledby="welcome-outcomes-heading">
          <p className="eyebrow">Before you begin</p>
          <h2 id="welcome-outcomes-heading">About this journey</h2>
          {singleVideo && content.rhythm ? <p className="rhythm">{content.rhythm}</p> : null}
          <ul>
            {content.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
          </ul>
        </section>

        <section aria-labelledby="journey-roadmap-heading">
          <p className="eyebrow">Lessons</p>
          <h2 id="journey-roadmap-heading">Lessons in Journey {journeyNumber}</h2>
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

        {!singleVideo ? <section className="transcript-panel" aria-labelledby="transcript-heading">
          <p className="eyebrow">Transcripts</p>
          <h2 id="transcript-heading">Read the video and audio transcripts</h2>
          <div className="transcript-grid">
            <TranscriptDetails
              title="Video transcript"
              segments={content.avatar_transcript ?? (content.audio_transcript ? [] : content.transcript)}
            />
            {companionAudioUrl ? (
              <TranscriptDetails
                title="Audio transcript"
                segments={content.audio_transcript ?? []}
              />
            ) : null}
          </div>
        </section> : null}

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
          <p>The transcript will be available when the recording is ready.</p>
        )}
      </div>
    </details>
  )
}
