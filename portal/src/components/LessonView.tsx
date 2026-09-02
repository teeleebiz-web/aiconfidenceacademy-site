import { useState } from 'react'
import type { Lesson, LessonProgress } from '../types'

type LessonViewProps = {
  lesson: Lesson
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
  progress,
  initialArtifact = '',
  reviewMode = false,
  previousLesson,
  nextLesson,
  onBack,
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

  return (
    <main className="lesson-main">
      <button className="back-link" type="button" onClick={onBack}>
        ← Back to my learning home
      </button>

      {reviewMode ? (
        <aside className="lesson-review-banner" aria-label="Owner review notice">
          <strong>Owner review · {lesson.status === 'draft' ? 'Unpublished draft' : 'Published lesson'}</strong>
          <span>Review mode is read-only and does not alter learner progress.</span>
        </aside>
      ) : null}

      <article className="lesson-article">
        <header className="lesson-hero">
          <div>
            <p className="eyebrow">Lesson {lesson.page_id}</p>
            <h1>{lesson.title}</h1>
            <p>{lesson.purpose}</p>
          </div>
          <span>{lesson.estimated_minutes} minutes</span>
        </header>

        <section>
          <h2>What you will be able to do</h2>
          <ul className="outcome-list">
            {lesson.content.outcomes.map((outcome) => (
              <li key={outcome}>{outcome}</li>
            ))}
          </ul>
        </section>

        <section>
          <p className="rhythm">{lesson.content.rhythm}</p>
          {lesson.content.teaching.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>

        {lesson.content.examples.length ? (
          <section className="example-panel">
            <p className="eyebrow">See it in everyday life</p>
            <h2>Examples to make the idea concrete</h2>
            <ul>
              {lesson.content.examples.map((example) => <li key={example}>{example}</li>)}
            </ul>
          </section>
        ) : null}

        <section>
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

        <section className="practice-panel">
          <p className="eyebrow">Guided practice</p>
          <h2>Begin with one purposeful conversation.</h2>
          <div className="prompt-box">
            <code>{lesson.content.practice_prompt}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(lesson.content.practice_prompt)}
            >
              Copy prompt
            </button>
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

        <section>
          <h2>Check the response with human judgment</h2>
          <ul>
            {lesson.content.review_questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          {revision ? <p><strong>Your required revision:</strong> {revision}</p> : null}
        </section>

        <section className="artifact-panel">
          <p className="eyebrow">Save evidence of your growth</p>
          <h2>{lesson.content.artifact}</h2>
          {reviewMode ? (
            <div className="review-only-panel">
              <strong>Learner evidence target</strong>
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

        <section>
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

        {reviewMode && onOpenLesson ? (
          <nav className="lesson-review-navigation" aria-label="Review adjacent lessons">
            {previousLesson ? (
              <button type="button" onClick={() => onOpenLesson(previousLesson)}>
                ← Lesson {previousLesson.page_id}
              </button>
            ) : <span />}
            {nextLesson ? (
              <button type="button" onClick={() => onOpenLesson(nextLesson)}>
                Lesson {nextLesson.page_id} →
              </button>
            ) : (
              <button type="button" onClick={onBack}>Return to Phase One overview</button>
            )}
          </nav>
        ) : null}
      </article>
    </main>
  )
}
