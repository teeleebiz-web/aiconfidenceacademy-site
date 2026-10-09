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
  enrollmentId?: string
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
  enrollmentId,
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

          <section className="p2-lesson-overview-video" aria-label={medium === 'video' ? 'Lesson video introduction' : 'Lesson audio introduction'}>
            <div className="p2-overview-video-symbol" aria-hidden="true">{medium === 'video' ? '▶' : '♫'}</div>
            <div>
              <p className="p2-overview-video-eyebrow">Before you begin</p>
              <h2>{medium === 'video' ? 'Watch the lesson introduction' : 'Listen to the lesson introduction'}</h2>
              <p>{medium === 'video' ? 'Video placeholder' : 'Audio placeholder'}</p>
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

              {pageId === '1.1' && (
                <section className="p2-responsibility-visual" aria-labelledby="p2-responsibility-heading">
                  <div className="p2-responsibility-heading">
                    <p className="eyebrow">One task. Clear responsibilities.</p>
                    <h2 id="p2-responsibility-heading">How AI-supported work moves forward</h2>
                    <p>AI contributes to the work, but people define its purpose, check the evidence and own the decision.</p>
                  </div>
                  <ol>
                    {[
                      ['01','Set the purpose','A person names the need, audience and result.'],
                      ['02','Ask for support','AI organizes, compares or drafts within the task limits.'],
                      ['03','Check the evidence','A person verifies facts, omissions, permissions and risk.'],
                      ['04','Decide and improve','A responsible person approves, corrects or pauses the work.'],
                    ].map(([number,title,explanation]) => (
                      <li key={number}><strong>{number}</strong><h3>{title}</h3><p>{explanation}</p></li>
                    ))}
                  </ol>
                  <a href="#p2-visual-title">See a worked example <span aria-hidden="true">↘</span></a>
                </section>
              )}

              <PhaseTwoProducedLessonReview production={production} learnerMode enrollmentId={enrollmentId} />

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
