import { useState } from 'react'
import type { Lesson, LessonProgress } from '../types'

type LessonViewProps = {
  lesson: Lesson
  progress?: LessonProgress
  initialArtifact?: string
  onBack: () => void
  onSave: (response: string) => Promise<void>
}

export function LessonView({
  lesson,
  progress,
  initialArtifact = '',
  onBack,
  onSave,
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
      setMessage('Your starting reason is saved. Lesson 1.1 is complete.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Your work could not be saved.')
    }
  }

  return (
    <main className="lesson-main">
      <button className="back-link" type="button" onClick={onBack}>
        ← Back to my learning home
      </button>

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
          <p><strong>Your revision:</strong> {lesson.content.revision}</p>
        </section>

        <section className="artifact-panel">
          <p className="eyebrow">Save evidence of your growth</p>
          <h2>{lesson.content.artifact}</h2>
          <label htmlFor="starting-reason">Write your two-sentence starting reason</label>
          <textarea
            id="starting-reason"
            rows={6}
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="I want to learn ChatGPT because…"
          />
          <button type="button" onClick={saveProgress} disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save and complete Lesson 1.1'}
          </button>
          {message ? (
            <p className={`form-message ${status}`} role="status">
              {message}
            </p>
          ) : null}
        </section>

        <section>
          <h2>Before you continue</h2>
          <ul>
            {lesson.content.knowledge_check.map((item) => (
              <li key={item.q}>{item.q}</li>
            ))}
          </ul>
          <p><strong>Stay engaged:</strong> {lesson.content.stay_engaged}</p>
          <p><strong>Optional continuation:</strong> {lesson.content.optional}</p>
        </section>
      </article>
    </main>
  )
}
