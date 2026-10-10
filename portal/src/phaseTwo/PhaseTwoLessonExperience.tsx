import { useEffect, useState } from 'react'
import { LESSON_12_INTRO_TRANSCRIPT } from './phaseTwoLesson12Intro'
import { LESSON_13_INTRO_TRANSCRIPT } from './phaseTwoLesson13Intro'
import { LESSON_14_INTRO_TRANSCRIPT } from './phaseTwoLesson14Intro'
import { LESSON_15_INTRO_TRANSCRIPT } from './phaseTwoLesson15Intro'
import { LESSON_16_INTRO_TRANSCRIPT } from './phaseTwoLesson16Intro'
import { phaseTwoRevisedIntroTranscripts } from './phaseTwoRevisedIntroTranscripts'
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
  onOpenWorkbook?: () => void
  onBackToLessons?: () => void
  remainingSeconds?: number
  enrollmentId?: string
  introAudio?: { url: string; transcript: string }
  introVideo?: { url: string; transcript: string; approvalStatus: 'founder_approved' | 'founder_review_pending'; captions_url?: string; poster_url?: string }
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
  onOpenWorkbook,
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
  const [producedMedia, setProducedMedia] = useState<{ guided: GuidedInstructionMedia; demos: VisualDemoClip[] } | null>(null)
  const [revisedIntro,setRevisedIntro] = useState<{url:string; transcript:string; approvalStatus:'founder_review_pending'; captions_url:string; poster_url:string} | null>(null)
  useEffect(() => {
    setRevisedIntro(null)
    if (!allowMediaReview || !['1.1','1.2','1.3','1.4'].includes(pageId) || typeof fetch !== 'function') return
    let cancelled=false
    const root='/assets/videos/phase-two-lesson-'+pageId.replace('.','-')+'/'
    void fetch(root+'intro-v2-manifest.json',{cache:'no-store'})
      .then(r=>{if(!r.ok)throw new Error('Revised introduction not published yet');return r.json()})
      .then((m:{lesson:string;intro_closing:string;instructor_voice_id:string;video_file:string;captions_file:string;poster_file:string})=>{
        if(cancelled || m.lesson!==pageId || m.intro_closing!=="Let's begin." ||
           m.instructor_voice_id!=='ac277b338cf64d8b9686784c43c563da' ||
           m.video_file!==`ACA-Phase-Two-Lesson-${pageId.replace('.','-')}-Introduction-v2.mp4` ||
           m.captions_file!==`ACA-Phase-Two-Lesson-${pageId.replace('.','-')}-Introduction-v2.vtt` ||
           m.poster_file!=='poster-v2.webp' || !phaseTwoRevisedIntroTranscripts[pageId])return
        setRevisedIntro({url:'https://aiconfidenceacademy.org'+root+m.video_file,captions_url:'https://aiconfidenceacademy.org'+root+m.captions_file,
          poster_url:'https://aiconfidenceacademy.org'+root+m.poster_file,transcript:phaseTwoRevisedIntroTranscripts[pageId],
          approvalStatus:'founder_review_pending'})
      }).catch(()=>{/* Keep original instructor video if the new verified source is not yet available. */})
    return ()=>{cancelled=true}
  },[pageId,allowMediaReview])
  useEffect(() => {
    if (!['1.2','1.3','1.4','1.5','1.6'].includes(pageId) || !allowMediaReview || typeof fetch !== 'function') return
    let canceled = false
    const root = '/assets/videos/phase-two-lesson-' + pageId.replace('.', '-') + '/'
    void Promise.all([
      fetch(root + 'guided-chapters.json').then(r => { if (!r.ok) throw new Error('Guided audio unavailable'); return r.json() }),
      fetch(root + 'production-report.json').then(r => { if (!r.ok) throw new Error('Visual case unavailable'); return r.json() }),
    ]).then(([chapters, report]) => {
      if (canceled || report.lesson !== pageId || chapters.chapters?.length !== 4 ||
          report.demonstrations?.length !== 4 ||
          report.voice_id !== 'ac277b338cf64d8b9686784c43c563da') return
      setProducedMedia({
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
  const selectedGuidedAudio = guidedInstruction ?? producedMedia?.guided
  const selectedDemoClips = demoClips ?? producedMedia?.demos
  const selectedVideo = (allowMediaReview ? revisedIntro : null) ?? introVideo ?? (['1.2','1.3','1.4','1.5','1.6'].includes(pageId) && allowMediaReview && producedMedia
    ? {
      url: location.origin + '/assets/videos/phase-two-lesson-' + pageId.replace('.', '-') + '/ACA-Phase-Two-Lesson-' + pageId.replace('.', '-') + '-Introduction.mp4',
      transcript: pageId === '1.2' ? LESSON_12_INTRO_TRANSCRIPT : pageId === '1.3' ? LESSON_13_INTRO_TRANSCRIPT : pageId === '1.4' ? LESSON_14_INTRO_TRANSCRIPT : pageId === '1.5' ? LESSON_15_INTRO_TRANSCRIPT : LESSON_16_INTRO_TRANSCRIPT,
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

          {(medium === 'audio' || ['1.2','1.3','1.4','1.5','1.6'].includes(pageId)) && approvedVideo && (
            <section className="p2-lesson-avatar" aria-labelledby="p2-lesson-avatar-heading">
              <h2 id="p2-lesson-avatar-heading">Watch your instructor introduce the lesson</h2>
              <video
                controls
                playsInline
                preload="auto"
                poster={approvedVideo.poster_url ?? (pageId === '1.1' ? '/assets/videos/phase-two-lesson-1-1/poster.webp' : ['1.2','1.3','1.4','1.5','1.6'].includes(pageId) ? '/assets/videos/phase-two-lesson-' + pageId.replace('.', '-') + '/poster.webp' : undefined)}
                src={approvedVideo.url}
                aria-label={`Lesson ${pageId} instructor introduction video`}
              >
                {approvedVideo.captions_url && <track kind="captions" label="Optional English captions" srcLang="en" src={approvedVideo.captions_url} />}
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

          {onOpenWorkbook && (
            <div className="p2-workbook-entry">
              <button type="button" className="workbook-entry-link" onClick={onOpenWorkbook}>
                Open Workbook — Lesson {pageId}
              </button>
              <p>Your released workbook study material and saved answers remain accessible after this lesson window closes.</p>
            </div>
          )}

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
