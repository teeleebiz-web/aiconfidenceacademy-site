import sealUrl from '../../../aca-official-seal.png'
import { PhaseTwoProducedLessonReview, validProducedLesson, type PhaseTwoProducedLesson } from './PhaseTwoProducedLessonReview'
import './phaseTwoLessonExperience.css'

type PhaseTwoLessonExperienceProps = {
  pageId: string
  lessonTitle: string
  journeyTitle: string
  purpose: string
  medium: 'video' | 'audio'
  production: PhaseTwoProducedLesson | undefined
  onOpenProject?: () => void
  onBackToLessons?: () => void
  remainingSeconds?: number
}

/**
 * The learner's actual lesson presentation.
 * Access checks happen at the caller; this component contains no administrative
 * review notices, publishing flags, course inventory or fake completion buttons.
 */
export function PhaseTwoLessonExperience({
  pageId,
  lessonTitle,
  journeyTitle,
  purpose,
  medium,
  production,
  onOpenProject,
  onBackToLessons,
  remainingSeconds,
}: PhaseTwoLessonExperienceProps) {
  const usable = validProducedLesson(production, pageId)
  return (
    <div className="p2-learner-experience">
      <a href="#p2-lesson-main" className="skip-link">Skip to lesson</a>
      <header className="p2-learner-experience-header">
        <a href="/" className="p2-learner-experience-brand" aria-label="AI Confidence Academy home">
          <img src={sealUrl} alt="" width="48" height="48" aria-hidden="true" />
          <span><strong>AI Confidence Academy</strong><small>Phase Two</small></span>
        </a>
        <span className="p2-learner-experience-location">{journeyTitle}</span>
      </header>

      <main id="p2-lesson-main" className="p2-learner-experience-main" tabIndex={-1}>
        {(onBackToLessons || remainingSeconds !== undefined) && (
          <div className="p2-learner-experience-controls">
            {onBackToLessons && <button type="button" onClick={onBackToLessons}>Your lessons</button>}
            {remainingSeconds !== undefined && <p role="timer" aria-live="off">Time remaining: {Math.floor(Math.max(0,remainingSeconds)/60)} min</p>}
          </div>
        )}
        <article className="p2-learner-experience-card">
          <header className="p2-learner-experience-hero">
            <p className="eyebrow">{journeyTitle}</p>
            <p className="p2-learner-experience-lesson-number">Lesson {pageId}</p>
            <h1>{lessonTitle}</h1>
            <p className="p2-learner-experience-purpose">{purpose}</p>
          </header>

          <section className="p2-learner-experience-media" aria-label="Lesson media">
            <span aria-hidden="true" className="p2-learner-experience-media-icon">{medium === 'audio' ? '♫' : '▶'}</span>
            <div>
              <h2>{medium === 'audio' ? 'Audio lesson' : 'Video lesson'}</h2>
              <p>{medium === 'audio' ? 'Audio placeholder' : 'Video placeholder'}</p>
            </div>
          </section>

          {usable ? (
            <>
              <section className="p2-learner-experience-intro" aria-labelledby="p2-learner-session-title">
                <h2 id="p2-learner-session-title">Your learning session</h2>
                <ol>
                  {production.pacing.map(step => (
                    <li key={step.key}><strong>{step.minutes} min</strong><span>{step.label}</span></li>
                  ))}
                </ol>
              </section>

              <PhaseTwoProducedLessonReview production={production} learnerMode />

              {onOpenProject && (
                <section className="p2-learner-experience-project" aria-labelledby="p2-project-link-title">
                  <div><h2 id="p2-project-link-title">Continue your project</h2>
                    <p>Keep your evidence, corrections and decision notes together as the course progresses.</p></div>
                  <button type="button" onClick={onOpenProject}>Open My Project Record</button>
                </section>
              )}
            </>
          ) : (
            <p role="alert">The lesson is temporarily unavailable. Please return to your learning home.</p>
          )}
        </article>
      </main>

      <footer className="p2-learner-experience-footer">
        <strong>AI Confidence Academy</strong>
        <span>People come first. AI is the tool. Confidence is the product.</span>
      </footer>
    </div>
  )
}
