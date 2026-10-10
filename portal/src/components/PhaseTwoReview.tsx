import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import sealUrl from '../../../aca-official-seal.png'
import { supabase } from '../lib/supabase'
import { PhaseTwoExperiencePreview } from '../phaseTwo/PhaseTwoExperiencePreview'
import { inspectPhaseTwoDraft } from '../phaseTwo/phaseTwoDraftIntegrity'
import { PhaseTwoLessonExperience } from '../phaseTwo/PhaseTwoLessonExperience'
import { PhaseTwoWorkbook } from '../phaseTwo/PhaseTwoWorkbook'
import type { GuidedInstructionMedia, VisualDemoClip } from '../phaseTwo/PhaseTwoGuidedMedia'
import './phase-two-review.css'

type PhaseTwoSource = {
  teaching: string
  worked_case: string
  apply_to_project: string
  ai_request: string
  verify_and_save: string
  applied_completion_check: string
  journey?: {
    prerequisite: string
    journey_result: string
    independent_application: string
    evidence_review: string
  }
}

type ReviewJourney = {
  id: string
  journey_number: number
  title: string
  promise: string
  status: string
}

type ReviewLesson = {
  id: string
  journey_id: string
  page_id: string
  title: string
  purpose: string
  course_position: number
  journey_position: number
  status: string
  content: {
    phase_two?: PhaseTwoSource
    planned_media?: 'video' | 'audio'
    media_assignment_status?: string
    phase_two_production?: import('../phaseTwo/PhaseTwoProducedLessonReview').PhaseTwoProducedLesson
    phase_two_media_plan?: {
      avatar_introduction?: { url: string; transcript: string; approvalStatus: 'founder_approved' }
      guided_instruction?: GuidedInstructionMedia
      demonstration_clips?: { approvalStatus: 'founder_approved' | 'founder_review_pending'; clips: VisualDemoClip[] }
      audio_lesson?: { generated_introduction?: { url: string; transcript: string; review_status?: string; voice_id?: string } }
    }
    video_path?: string | null
    audio_path?: string | null
  }
}

type ReviewData = { journeys: ReviewJourney[]; lessons: ReviewLesson[] }
type ReviewStatus = 'loading' | 'signed-out' | 'denied' | 'ready' | 'error'

const courseCode = 'phase-two-ai-professional-builder'
const teachingSections: Array<{ key: keyof Omit<PhaseTwoSource, 'journey'>; title: string; number: string }> = [
  { key: 'teaching', title: 'Teaching', number: '01' },
  { key: 'worked_case', title: 'Worked case', number: '02' },
  { key: 'apply_to_project', title: 'Apply it to your project', number: '03' },
  { key: 'ai_request', title: 'AI request', number: '04' },
  { key: 'verify_and_save', title: 'Verify and save', number: '05' },
  { key: 'applied_completion_check', title: 'Applied completion check', number: '06' },
]

export function PhaseTwoReview() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [status, setStatus] = useState<ReviewStatus>('loading')
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [data, setData] = useState<ReviewData>({ journeys: [], lessons: [] })
  const [chosen, setChosen] = useState('1.1')
  const [reviewView, setReviewView] = useState<'source' | 'learner'>('source')
  const [workbookPreview, setWorkbookPreview] = useState<string | null>(null)
  const [reviewEmail, setReviewEmail] = useState('')
  const [reviewPassword, setReviewPassword] = useState('')
  const [signInMethod, setSignInMethod] = useState<'password' | 'link'>('password')
  const [signInBusy, setSignInBusy] = useState(false)
  const [signInMessage, setSignInMessage] = useState('')

  async function handleReviewSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSignInBusy(true)
    setSignInMessage('')
    try {
      if (signInMethod === 'password') {
        const result = await supabase.auth.signInWithPassword({
          email: reviewEmail.trim(),
          password: reviewPassword,
        })
        if (result.error) throw result.error
      } else {
        const result = await supabase.auth.signInWithOtp({
          email: reviewEmail.trim(),
          options: {
            shouldCreateUser: false,
            emailRedirectTo: window.location.origin + '/learn/?review=phase-two&lesson=' +
              encodeURIComponent(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '2.1'].includes(new URLSearchParams(window.location.search).get('lesson') ?? '')
                ? new URLSearchParams(window.location.search).get('lesson')!
                : '1.1'),
          },
        })
        if (result.error) throw result.error
        setSignInMessage('Check your email for a secure sign-in link to this review.')
      }
    } catch {
      setSignInMessage(signInMethod === 'password'
        ? 'Sign-in failed. Check your Academy email and password.'
        : 'The secure link could not be sent. Try again or use your Academy password.')
    } finally {
      setSignInBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data: authData }) => {
      if (active) { setSession(authData.session); setAuthReady(true) }
    }).catch(() => {
      if (active) { setSession(null); setAuthReady(true) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setAuthReady(true) }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (!session?.user) {
      setStatus('signed-out')
      setData({ journeys: [], lessons: [] })
      return
    }

    let cancelled = false
    async function loadProtectedDraft() {
      setStatus('loading')
      // The query never substitutes for Supabase RLS. Both must allow the owner.
      const owner = await supabase.rpc('is_aca_curriculum_owner')
      if (cancelled) return
      if (owner.error || owner.data !== true) {
        setStatus('denied')
        setData({ journeys: [], lessons: [] })
        return
      }

      const course = await supabase.from('courses')
        .select('id, code, status')
        .eq('code', courseCode)
        .eq('status', 'draft')
        .maybeSingle()
      if (cancelled) return
      if (course.error || !course.data) { setStatus('error'); return }

      const [journeys, lessons] = await Promise.all([
        supabase.from('course_journeys')
          .select('id, journey_number, title, promise, status')
          .eq('course_id', course.data.id).order('journey_number'),
        supabase.from('lessons')
          .select('id, journey_id, page_id, title, purpose, course_position, journey_position, status, content')
          .eq('course_id', course.data.id).order('course_position'),
      ])
      if (cancelled) return
      if (journeys.error || lessons.error) { setStatus('error'); return }
      const next: ReviewData = {
        journeys: (journeys.data ?? []) as ReviewJourney[],
        lessons: (lessons.data ?? []) as ReviewLesson[],
      }
      // Require every source teaching section and the full media allocation.
      const validation = inspectPhaseTwoDraft(next.journeys, next.lessons)
      if (!validation.ready) {
        setValidationIssues(validation.issues)
        setStatus('error')
        return
      }
      setValidationIssues([])
      setData(next)
      setStatus('ready')
    }
    void loadProtectedDraft().catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [authReady, session?.user.id])

  const lesson = useMemo(() => data.lessons.find(item => item.page_id === chosen) ?? data.lessons[0], [chosen, data.lessons])
  const journey = data.journeys.find(item => item.id === lesson?.journey_id)
  const journeyLessons = data.lessons.filter(item => item.journey_id === journey?.id)
  const introduction = journeyLessons[0]?.content.phase_two?.journey
  const videoCount = journeyLessons.filter(item => item.content.planned_media === 'video').length
  const audioCount = journeyLessons.filter(item => item.content.planned_media === 'audio').length
  const requestedPageId = new URLSearchParams(window.location.search).get('lesson')
  const lessonForReview = data.lessons.find(item =>
    item.page_id === requestedPageId &&
    item.content.phase_two_production?.approval_status === 'founder_review_not_published'
  ) ?? data.lessons.find(item => item.page_id === '1.1')
  const lessonJourney = data.journeys.find(item => item.id === lessonForReview?.journey_id)

  // Open one complete learner lesson per direct link, without a construction dashboard.
  // Every source record remains access-controlled through the existing Academy login.
  if (status === 'ready' && workbookPreview) {
    return <PhaseTwoWorkbook journey={Number(workbookPreview.split('.')[0])}
      initialLesson={Number(workbookPreview.split('.')[1])}
      onBack={() => setWorkbookPreview(null)} />
  }
  if (status === 'ready' && lessonForReview) {
    return <PhaseTwoLessonExperience
      pageId={lessonForReview.page_id}
      journeyTitle={lessonJourney?.title ?? 'AI Strategy and Business Opportunity'}
      lessonTitle={lessonForReview.title}
      purpose={lessonForReview.purpose}
      medium={lessonForReview.content.planned_media === 'video' ? 'video' : 'audio'}
      production={lessonForReview.content.phase_two_production}
      introVideo={lessonForReview.content.phase_two_media_plan?.avatar_introduction}
      guidedInstruction={lessonForReview.content.phase_two_media_plan?.guided_instruction}
      allowMediaReview
      onOpenWorkbook={['1.1','1.2','1.3','1.4','1.5','1.6','2.1'].includes(lessonForReview.page_id)
        ? () => setWorkbookPreview(lessonForReview.page_id) : undefined}
      demoClips={['founder_approved','founder_review_pending'].includes(lessonForReview.content.phase_two_media_plan?.demonstration_clips?.approvalStatus ?? '')
        ? lessonForReview.content.phase_two_media_plan?.demonstration_clips?.clips
        : undefined}
      introAudio={lessonForReview.content.phase_two_media_plan?.audio_lesson?.generated_introduction?.review_status === 'founder_approved' &&
        lessonForReview.content.phase_two_media_plan?.audio_lesson?.generated_introduction?.voice_id === 'ac277b338cf64d8b9686784c43c563da'
          ? lessonForReview.content.phase_two_media_plan.audio_lesson.generated_introduction
          : undefined}
    />
  }

  return (
    <div className="phase-two-review">
      <a href="#p2-main" className="skip-link">Skip to curriculum</a>
      <header className="p2-site-header">
        <a href="/" className="p2-site-brand">
          <img src={sealUrl} alt="" width="50" height="50" />
          <span><strong>AI Confidence Academy</strong><small>Phase Two</small></span>
        </a>
        
      </header>

      <main id="p2-main" className="p2-page" tabIndex={-1}>
        {status === 'loading' && <p role="status">Checking protected curriculum access…</p>}
        {status === 'signed-out' && (
          <section className="p2-state" aria-labelledby="p2-sign-in">
            <p className="eyebrow">AI Confidence Academy</p>
            <h1 id="p2-sign-in">Sign in to Phase Two</h1>
            <p>Sign in with your Academy account to continue your learning journey.</p>
            <form className="p2-sign-in-form" onSubmit={handleReviewSignIn}>
              <label htmlFor="p2-review-email">Academy email</label>
              <input id="p2-review-email" type="email" autoComplete="email" required
                value={reviewEmail} onChange={event => setReviewEmail(event.target.value)} />
              {signInMethod === 'password' && (
                <>
                  <label htmlFor="p2-review-password">Password</label>
                  <input id="p2-review-password" type="password" autoComplete="current-password"
                    required value={reviewPassword} onChange={event => setReviewPassword(event.target.value)} />
                </>
              )}
              <button type="submit" disabled={signInBusy}>
                {signInBusy ? 'Please wait…' : signInMethod === 'password' ? 'Sign in securely' : 'Send secure sign-in link'}
              </button>
            </form>
            {signInMessage && <p role="status">{signInMessage}</p>}
            <button className="p2-auth-switch" type="button" onClick={() => {
              setSignInMethod(signInMethod === 'password' ? 'link' : 'password')
              setSignInMessage('')
            }}>
              {signInMethod === 'password' ? 'Use a one-time email link instead' : 'Use my password instead'}
            </button>
          </section>
        )}
        {status === 'denied' && (
          <section className="p2-state" aria-labelledby="p2-denied">
            <h1 id="p2-denied">Access is not available</h1>
            <p>This learning material is not available for this account.</p>
            <a href="/learn/">Return to the Academy</a>
          </section>
        )}
        {status === 'error' && (
          <section className="p2-state" aria-labelledby="p2-error">
            <h1 id="p2-error">Your lesson could not load</h1>
            <p>Please try again later. If the problem continues, contact the Academy.</p>
            {validationIssues.length > 0 && (
              <ul>{validationIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>
            )}
          </section>
        )}

        {status === 'ready' && lesson && journey && (
          <>
            <header className="p2-overview">
              <div>
                <p className="eyebrow">Phase Two · 2026 curriculum · Version 2.0</p>
                <h1>AI Professional and Builder Pathway</h1>
                <p>Six journeys. Thirty-six lessons. One continuing business project.</p>
                <p className="p2-review-note">Owner-only review. All lessons and media positions remain unpublished; proposed video/audio assignments require founder review.</p>
              </div>
              <div className="p2-totals" aria-label="Curriculum counts">
                <strong>36</strong><span>lessons</span><small>18 video slots · 18 audio slots</small>
              </div>
            </header>

            <div className="p2-review-view-toggle" role="group" aria-label="Founder review perspectives">
              <button type="button" aria-pressed={reviewView === 'source'}
                onClick={() => setReviewView('source')}>Curriculum source review</button>
              <button type="button" aria-pressed={reviewView === 'learner'}
                onClick={() => setReviewView('learner')}>Learner experience walkthrough</button>
            </div>

            {reviewView === 'learner' ? (
              <PhaseTwoExperiencePreview journeys={data.journeys} lessons={data.lessons} />
            ) : (
              <>
            <nav className="p2-journey-nav" aria-label="Phase Two journey selection">
              {data.journeys.map(item => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={item.id === journey.id}
                  className={item.id === journey.id ? 'p2-journey-choice chosen' : 'p2-journey-choice'}
                  onClick={() => { const first = data.lessons.find(l => l.journey_id === item.id); if (first) setChosen(first.page_id) }}
                >
                  <small>Journey {item.journey_number}</small>
                  <span>{item.title}</span>
                </button>
              ))}
            </nav>

            <section className="p2-journey-panel" aria-labelledby="p2-journey-title">
              <div>
                <p className="eyebrow">Week {journey.journey_number} · Six guided lessons</p>
                <h2 id="p2-journey-title">{journey.title}</h2>
                <p>{journey.promise}</p>
                {introduction && <div className="p2-journey-evidence">
                  <p><strong>Journey result:</strong> {introduction.journey_result}</p>
                  <p><strong>Independent application:</strong> {introduction.independent_application}</p>
                  <p><strong>Evidence review:</strong> {introduction.evidence_review}</p>
                </div>}
              </div>
              <div className="p2-media-count">
                <span>{videoCount} video-led</span><span>{audioCount} audio-led</span>
                <small>Media files and transcripts are pending production.</small>
              </div>
            </section>

            <div className="p2-content-layout">
              <nav className="p2-lesson-nav" aria-label="Lessons in selected journey">
                <h2>Lessons</h2>
                {journeyLessons.map(item => (
                  <button type="button" key={item.id} aria-current={lesson.id === item.id ? 'page' : undefined}
                    onClick={() => setChosen(item.page_id)}>
                    <small>{item.page_id} · {item.content.planned_media === 'video' ? 'Video' : 'Audio'} placeholder</small>
                    <strong>{item.title}</strong>
                  </button>
                ))}
              </nav>
              <article className="p2-lesson-article" aria-labelledby="p2-lesson-title">
                <header>
                  <p className="eyebrow">Lesson {lesson.page_id} · Approximately 60 minutes · Unpublished</p>
                  <h2 id="p2-lesson-title">{lesson.title}</h2>
                  <p>{lesson.purpose}</p>
                </header>

                <section className="p2-media-placeholder" aria-label="Media production placeholder">
                  <div className="p2-media-icon" aria-hidden="true">{lesson.content.planned_media === 'video' ? '▶' : '♫'}</div>
                  <div>
                    <strong>{lesson.content.planned_media === 'video' ? 'Avatar and demonstration video' : 'Guided audio instruction'}</strong>
                    <p>{lesson.content.planned_media === 'video'
                      ? 'Video placeholder. The approved recording, captions and accessible transcript will be attached after review.'
                      : 'Audio placeholder. The approved narration and readable transcript will be attached after review.'}</p>
                    <small>Provisional lesson media assignment — not approved or recorded.</small>
                  </div>
                </section>

                <section className="p2-lesson-rhythm" aria-labelledby="p2-session-flow">
                  <div>
                    <p className="eyebrow">Approved lesson rhythm</p>
                    <h3 id="p2-session-flow">Your 60-minute learning session</h3>
                    <p>The durations are teaching targets, not timers or automatic completion credit.</p>
                  </div>
                  <ol aria-label="Lesson activity plan">
                    {(lesson.journey_position === 6
                      ? [
                          ['10 min', 'Integration instruction'],
                          ['10 min', 'Challenge case'],
                          ['30 min', 'Project testing and revision'],
                          ['10 min', 'Evidence review'],
                        ]
                      : [
                          ['15 min', 'Teaching'],
                          ['10 min', 'Worked demonstration'],
                          ['25 min', 'Project application'],
                          ['10 min', 'Verification and applied check'],
                        ]).map(([duration, label]) => (
                      <li key={label}><strong>{duration}</strong><span>{label}</span></li>
                    ))}
                  </ol>
                </section>

                {!lesson.content.phase_two ? <p role="alert">The approved Phase Two teaching brief is missing for this lesson.</p> : (
                  <div className="p2-teaching-sections">
                    {teachingSections.map(section => (
                      <section className="p2-section" key={section.key}>
                        <p className="p2-section-number">{section.number}</p>
                        <h3>{section.title}</h3>
                        {section.key === 'ai_request'
                          ? <pre className="p2-ai-request">{lesson.content.phase_two![section.key]}</pre>
                          : <p>{lesson.content.phase_two![section.key]}</p>}
                      </section>
                    ))}
                  </div>
                )}
                <footer className="p2-lesson-end">
                  <p><strong>Source:</strong> Current six-week curriculum master, Version 2.0, October 4, 2026.</p>
                  <p>Lesson content is review-only. No progress, workbook submission, learner access or release is activated here.</p>
                  {data.lessons.find(item => item.course_position === lesson.course_position + 1) && (
                    <button type="button" onClick={() => setChosen(data.lessons.find(item => item.course_position === lesson.course_position + 1)!.page_id)}>
                      Review next lesson →
                    </button>
                  )}
                </footer>
              </article>
            </div>
              </>
            )}
          </>
        )}
      </main>
      <footer className="p2-site-footer">AI Confidence Academy · People come first. AI is the tool. Confidence is the product. · AI assists, humans verify.</footer>
    </div>
  )
}
