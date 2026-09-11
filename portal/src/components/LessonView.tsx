import { useEffect, useState } from 'react'
import type { Lesson, LessonProgress } from '../types'

type LessonViewProps = {
  lesson: Lesson
  videoSrc?: string
  audioSrc?: string
  audioPreload?: 'none' | 'metadata'
  workbookHref?: string
  progress?: LessonProgress
  initialArtifact?: string
  reviewMode?: boolean
  previousLesson?: Lesson
  nextLesson?: Lesson
  onBack: () => void
  onSave: (response: string) => Promise<void>
  onOpenLesson?: (lesson: Lesson) => void
}

export function LessonView({
  lesson,
  audioSrc,
  audioPreload = 'none',
  videoSrc,
  workbookHref,
  progress,
  initialArtifact = '',
  reviewMode = false,
  nextLesson,
  onSave,
  onOpenLesson,
}: LessonViewProps) {
  const [response, setResponse] = useState(initialArtifact)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    progress?.status === 'completed' ? 'saved' : 'idle',
  )
  const [message, setMessage] = useState(
    progress?.status === 'completed' ? 'This lesson is complete.' : '',
  )
  const [promptCopied, setPromptCopied] = useState(false)

  useEffect(() => {
    setResponse(initialArtifact)
    setStatus(progress?.status === 'completed' ? 'saved' : 'idle')
    setMessage(progress?.status === 'completed' ? 'This lesson is complete.' : '')
    setPromptCopied(false)
  }, [initialArtifact, lesson.id, progress?.status])

  async function saveProgress() {
    if (response.trim().length < 20) {
      setStatus('error')
      setMessage('Please write at least a few thoughtful words before saving.')
      return
    }

    setStatus('saving')
    setMessage('')

    try {
      await onSave(response.trim())
      setStatus('saved')
      setMessage(`Your work is saved. Lesson ${lesson.page_id} is complete.`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Your work could not be saved.')
    }
  }

  const revision = lesson.content.required_revision ?? lesson.content.revision
  const optionalPractice = lesson.content.optional_practice ?? lesson.content.optional
  const sessionMinutes = Math.min(60, Math.max(45, lesson.estimated_minutes))
  const sessionPlan = buildSessionPlan(sessionMinutes)
  const scriptOnly = lesson.page_id === '3.4' && !videoSrc && !audioSrc

  return (
    <main className="lesson-main">
      <article className="lesson-article">
        <header className="lesson-hero">
          <div>
            <p className="eyebrow">Lesson {lesson.page_id}</p>
            <h1 style={lesson.page_id === '3.5' ? { color: '#ffffff' } : undefined}>{lesson.title}</h1>
            <p>{lesson.purpose}</p>
          </div>
          <span>{sessionMinutes} minute session</span>
        </header>

        {videoSrc || audioSrc || lesson.content.audio_overview_script ? (
          <section className="practice-panel" aria-labelledby="lesson-audio-heading">
            <h2 id="lesson-audio-heading">{scriptOnly ? 'Lesson introduction' : `${videoSrc ? 'Watch' : 'Listen to'} Lesson ${lesson.page_id}`}</h2>
            {videoSrc ? <video key={videoSrc} controls playsInline preload="metadata" src={videoSrc} aria-label={`Lesson ${lesson.page_id} video`} style={{ display: 'block', width: '100%', maxWidth: 640, height: 'auto', margin: '0 auto 1rem' }}>Your browser does not support video playback.</video> : audioSrc ? <audio key={audioSrc} controls preload={audioPreload} src={audioSrc} aria-label={`Lesson ${lesson.page_id} audio`} style={{ width: '100%' }}>
              Your browser does not support audio playback.
            </audio> : scriptOnly ? null : <p className="review-only-panel">Audio will be available here.</p>}
            {lesson.content.audio_overview_script ? (
              <details>
                <summary>Read the lesson introduction</summary>
                {lesson.content.audio_overview_script.split('\n\n').map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </details>
            ) : null}
          </section>
        ) : null}

        {lesson.content.written_introduction ? (
          <section aria-labelledby="lesson-starting-point-heading">
            <h2 id="lesson-starting-point-heading">Your starting point</h2>
            <p>{lesson.content.written_introduction}</p>
          </section>
        ) : null}

        <section className="session-map" aria-labelledby="session-map-heading">
          <p className="eyebrow">Your session at a glance</p>
          <h2 id="session-map-heading">A complete learning rhythm—not just a reading</h2>
          <ol>
            {sessionPlan.map((step) => (
              <li key={step.label}>
                <strong>{step.minutes} min</strong>
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
          <p>Optional continuation is available after the core session and is not included in this estimate.</p>
        </section>

        <section id="lesson-outcomes">
          <h2>What you will be able to do</h2>
          <ul className="outcome-list">
            {lesson.content.outcomes.map((outcome) => (
              <li key={outcome}>{outcome}</li>
            ))}
          </ul>
        </section>

        <section id="lesson-teaching">
          <p className="eyebrow">Learn and understand</p>
          <h2>{lesson.content.teaching_heading ?? 'Build the idea in plain language'}</h2>
          <p className="rhythm">{lesson.content.rhythm}</p>
          {lesson.content.teaching.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>

        {lesson.content.examples.length ? (
          <section className="example-panel" aria-labelledby="examples-heading">
            <p className="eyebrow">See it in everyday life</p>
            <h2 id="examples-heading">Examples to make the idea concrete</h2>
            <ul>
              {lesson.content.examples.map((example) => <li key={example}>{example}</li>)}
            </ul>
          </section>
        ) : null}

        <section id="lesson-vocabulary">
          <h2>Words you will use</h2>
          <dl className="vocabulary-grid">
            {Object.entries(lesson.content.vocabulary).map(([term, definition]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{definition}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="practice-panel" id="lesson-practice">
          {workbookHref && <a className="workbook-entry-link" href={workbookHref} target="_blank" rel="noopener noreferrer">Open Workbook</a>}
          <p className="eyebrow">Guided practice</p>
          <h2>Begin with one purposeful conversation.</h2>
          {lesson.content.practice_material ? (
            <div className="practice-material" aria-labelledby="practice-material-heading">
              <h3 id="practice-material-heading">Your practice material</h3>
              {lesson.content.practice_material.split('\n\n').map((paragraph) => (
                <p key={paragraph} style={{ whiteSpace: 'pre-wrap' }}>{paragraph}</p>
              ))}
            </div>
          ) : null}
          <div className="prompt-box">
            <code>{lesson.content.practice_prompt}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(lesson.content.practice_prompt)
                setPromptCopied(true)
              }}
            >
              {promptCopied ? 'Prompt copied' : 'Copy prompt'}
            </button>
            <span className="visually-hidden" aria-live="polite">
              {promptCopied ? 'The practice prompt was copied to your clipboard.' : ''}
            </span>
          </div>
          <ol>
            {lesson.content.practice_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="safety-note">
            <strong>Before you submit:</strong> Do not enter private, confidential, identifying,
            or sensitive information.
          </p>
        </section>

        <section id="lesson-verification">
          <p className="eyebrow">Verify and revise</p>
          <h2>Check the response with human judgment</h2>
          <ul>
            {lesson.content.review_questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          {revision ? <p><strong>Your required revision:</strong> {revision}</p> : null}
        </section>

        <section className="artifact-panel" id="lesson-reflection">
          <p className="eyebrow">Save evidence of your growth</p>
          <h2>{lesson.content.artifact}</h2>
          {reviewMode ? (
            <div className="review-only-panel">
              <strong>What to save</strong>
              <p>{lesson.content.completion_gate ?? 'Complete the practice, revise the result, and save the named evidence item.'}</p>
            </div>
          ) : (
            <>
              <label htmlFor="lesson-evidence">Write or paste the evidence you want to save</label>
              <textarea
                id="lesson-evidence"
                rows={6}
                value={response}
                onChange={(event) => setResponse(event.target.value)}
                placeholder="Write your reflection, plan, or completed practice evidence here…"
              />
              <button type="button" onClick={saveProgress} disabled={status === 'saving'}>
                {status === 'saving' ? 'Saving…' : `Save and complete Lesson ${lesson.page_id}`}
              </button>
              {message ? (
                <p className={`form-message ${status}`} role="status">
                  {message}
                </p>
              ) : null}
            </>
          )}
        </section>

        <section id="lesson-check">
          <p className="eyebrow">Reflect and continue</p>
          <h2>Before you continue</h2>
          <ul>
            {lesson.content.knowledge_check.map((item) => (
              <li key={item.q}>{item.q}</li>
            ))}
          </ul>
          <p><strong>Stay engaged:</strong> {lesson.content.stay_engaged}</p>
          {optionalPractice ? <p><strong>Optional continuation:</strong> {optionalPractice}</p> : null}
          {lesson.content.support ? (
            <p className="support-note"><strong>If you need support:</strong> {lesson.content.support}</p>
          ) : null}
        </section>

        {lesson.content.sources?.length ? (
          <section aria-labelledby="lesson-sources-heading">
            <h2 id="lesson-sources-heading">Check current guidance</h2>
            <ul>
              {lesson.content.sources.map((source) => (
                <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>
              ))}
            </ul>
          </section>
        ) : null}

        {onOpenLesson ? (
          <nav className="lesson-review-navigation" aria-label="Continue through Phase One">
            {nextLesson ? (
              <button
                type="button"
                aria-label={`${nextLesson.journey_id === lesson.journey_id ? 'Next lesson' : 'Next Journey, lesson'} ${nextLesson.page_id}: ${nextLesson.title}`}
                onClick={() => onOpenLesson(nextLesson)}
              >
                <small>{nextLesson.journey_id === lesson.journey_id ? 'Next lesson' : 'Next Journey'}</small>
                <span>{nextLesson.page_id} · {nextLesson.title} →</span>
              </button>
            ) : (
              <p>Phase One complete</p>
            )}
          </nav>
        ) : null}
      </article>
    </main>
  )
}

function buildSessionPlan(totalMinutes: number) {
  if (totalMinutes >= 60) {
    return [
      { label: 'Settle in and focus', minutes: 3 },
      { label: 'Learn and see examples', minutes: 15 },
      { label: 'Complete guided practice', minutes: 22 },
      { label: 'Verify and revise', minutes: 10 },
      { label: 'Reflect, check, and save', minutes: 10 },
    ]
  }

  if (totalMinutes >= 55) {
    return [
      { label: 'Settle in and focus', minutes: 3 },
      { label: 'Learn and see examples', minutes: 15 },
      { label: 'Complete guided practice', minutes: 20 },
      { label: 'Verify and revise', minutes: 9 },
      { label: 'Reflect, check, and save', minutes: totalMinutes - 47 },
    ]
  }

  if (totalMinutes >= 50) {
    return [
      { label: 'Settle in and focus', minutes: 3 },
      { label: 'Learn and see examples', minutes: 15 },
      { label: 'Complete guided practice', minutes: 15 },
      { label: 'Verify and revise', minutes: 8 },
      { label: 'Reflect, check, and save', minutes: totalMinutes - 41 },
    ]
  }

  return [
    { label: 'Settle in and focus', minutes: 3 },
    { label: 'Learn and see examples', minutes: 12 },
    { label: 'Complete guided practice', minutes: 15 },
    { label: 'Verify and revise', minutes: 8 },
    { label: 'Reflect, check, and save', minutes: totalMinutes - 38 },
  ]
}
