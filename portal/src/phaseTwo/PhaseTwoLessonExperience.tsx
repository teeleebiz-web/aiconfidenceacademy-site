import { useEffect, useState } from 'react'
import { LESSON_12_INTRO_TRANSCRIPT } from './phaseTwoLesson12Intro'
import sealUrl from '../../../aca-official-seal.png'
import { PhaseTwoProducedLessonReview, validProducedLesson, type PhaseTwoProducedLesson } from './PhaseTwoProducedLessonReview'
import { PhaseTwoGuidedAudio, type GuidedInstructionMedia, type VisualDemoClip } from './PhaseTwoGuidedMedia'
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
  introAudio?: { url: string; transcript: string }
  introVideo?: { url: string; transcript: string; approvalStatus: 'founder_approved' | 'founder_review_pending' }
  guidedInstruction?: GuidedInstructionMedia
  demoClips?: VisualDemoClip[]
  allowMediaReview?: boolean
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
  introAudio,
  introVideo,
  guidedInstruction,
  demoClips,
  allowMediaReview = false,
}: PhaseTwoLessonExperienceProps) {
  const usable = validProducedLesson(production, pageId)
  const [lesson12Media, setLesson12Media] = useState<{ guided: GuidedInstructionMedia; demos: VisualDemoClip[] } | null>(null)
  useEffect(() => {
    if (pageId !== '1.2' || !allowMediaReview || typeof fetch !== 'function') return
    let canceled = false
    const root = '/assets/videos/phase-two-lesson-1-2/'
    void Promise.all([
      fetch(root + 'guided-chapters.json').then(r => { if (!r.ok) throw new Error('Guided audio unavailable'); return r.json() }),
      fetch(root + 'production-report.json').then(r => { if (!r.ok) throw new Error('Visual case unavailable'); return r.json() }),
    ]).then(([chapters, report]) => {
      if (canceled || report.lesson !== '1.2' || chapters.chapters?.length !== 4 ||
          report.demonstrations?.length !== 4 ||
          report.voice_id !== 'ac277b338cf64d8b9686784c43c563da') return
      setLesson12Media({
        guided: {
          url: location.origin + root + report.guided_audio.file,
          duration_seconds: chapters.duration_seconds,
          voice_id: report.voice_id,
          chapters: chapters.chapters,
          approvalStatus: 'founder_review_pending',
        },
        demos: report.demonstrations.map((clip: {
          key: string; title: string; file: string; captions: string;
          transcript: string; duration_seconds: number; fictional_training_example: true
        }) => ({
          key: clip.key, title: clip.title,
          url: location.origin + root + clip.file,
          captions_url: location.origin + root + clip.captions,
          transcript: clip.transcript,
          duration_seconds: clip.duration_seconds,
          fictional_training_example: true as const,
        })),
      })
    }).catch(() => { /* Keep normal fallback until the official media release is live. */ })
    return () => { canceled = true }
  }, [pageId, allowMediaReview])
  const selectedGuidedAudio = guidedInstruction ?? lesson12Media?.guided
  const selectedDemoClips = demoClips ?? lesson12Media?.demos
  const selectedVideo = introVideo ?? (pageId === '1.2' && allowMediaReview && lesson12Media
    ? {
      url: location.origin + '/assets/videos/phase-two-lesson-1-2/ACA-Phase-Two-Lesson-1-2-Introduction.mp4',
      transcript: LESSON_12_INTRO_TRANSCRIPT,
      approvalStatus: 'founder_review_pending' as const,
    } : null)
  const approvedGuidedAudio = (selectedGuidedAudio?.approvalStatus === 'founder_approved' ||
    (allowMediaReview && selectedGuidedAudio?.approvalStatus === 'founder_review_pending')) &&
    selectedGuidedAudio.voice_id === 'ac277b338cf64d8b9686784c43c563da' &&
    /^https:\/\//.test(selectedGuidedAudio.url) &&
    Array.isArray(selectedGuidedAudio.chapters) && selectedGuidedAudio.chapters.length === 4
      ? selectedGuidedAudio : null
  const approvedVideo = (selectedVideo?.approvalStatus === 'founder_approved' ||
    (allowMediaReview && selectedVideo?.approvalStatus === 'founder_review_pending')) &&
    /^https:\/\//.test(selectedVideo.url) && selectedVideo.transcript.trim().length > 0
      ? selectedVideo : null
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

          {(medium === 'audio' || pageId === '1.2') && approvedVideo && (
            <section className="p2-lesson-avatar" aria-labelledby="p2-lesson-avatar-heading">
              <h2 id="p2-lesson-avatar-heading">Watch your instructor introduce the lesson</h2>
              <video
                controls
                playsInline
                preload="auto"
                poster={pageId === '1.1' ? '/assets/videos/phase-two-lesson-1-1/poster.webp' : pageId === '1.2' ? '/assets/videos/phase-two-lesson-1-2/poster.webp' : undefined}
                src={approvedVideo.url}
                aria-label={`Lesson ${pageId} instructor introduction video`}
              >
                Your browser does not support video playback.
              </video>
              {approvedVideo.transcript.trim() && (
                <details>
                  <summary>Read the lesson introduction</summary>
                  {approvedVideo.transcript.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </details>
              )}
            </section>
          )}

          {approvedGuidedAudio
            ? <PhaseTwoGuidedAudio lessonId={pageId} media={approvedGuidedAudio} />
            : <section className="p2-lesson-overview-video" aria-label={medium === 'video' ? 'Lesson video introduction' : 'Lesson audio introduction'}>
            <div className="p2-overview-video-symbol" aria-hidden="true">{medium === 'video' ? '▶' : '♫'}</div>
            <div>
              <p className="p2-overview-video-eyebrow">Before you begin</p>
              <h2>{medium === 'video' ? 'Watch the lesson introduction' : approvedVideo ? 'Listen to guided instruction' : 'Listen to the lesson introduction'}</h2>
              {medium === 'audio' && introAudio?.url ? (
                <>
                  <audio controls preload="metadata" src={introAudio.url} aria-label={`Lesson ${pageId} audio introduction`}>
                    Your browser does not support audio playback.
                  </audio>
                  <details className="p2-intro-transcript">
                    <summary>Read the audio introduction</summary>
                    {introAudio.transcript.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                  </details>
                </>
              ) : <p>{medium === 'video' ? 'Video placeholder' : 'Audio placeholder'}</p>}
            </div>
          </section>}

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

              <PhaseTwoProducedLessonReview production={production} learnerMode enrollmentId={enrollmentId} demoClips={selectedDemoClips} />

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
