import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import sealUrl from '../../../aca-official-seal.png'
import { supabase } from '../lib/supabase'
import { usePageStart } from '../lib/usePageStart'
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
export function PhaseTwoReview() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [status, setStatus] = useState<ReviewStatus>('loading')
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [data, setData] = useState<ReviewData>({ journeys: [], lessons: [] })
  const [chosen, setChosen] = useState(new URLSearchParams(window.location.search).get('lesson') ?? '1.1')
  const [showCurriculum, setShowCurriculum] = useState(new URLSearchParams(window.location.search).get('view') === 'curriculum')
  const [workbookJourney, setWorkbookJourney] = useState(1)
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
              encodeURIComponent(/^[1-6]\.[1-6]$/.test(new URLSearchParams(window.location.search).get('lesson') ?? '')
                ? new URLSearchParams(window.location.search).get('lesson')!
                : '1.1'),
          },
        })
        if (result.error) throw result.error
        setSignInMessage('Check your email for a secure sign-in link to your learning space.')
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

  const lessonForReview = useMemo(() => data.lessons.find(item => item.page_id === chosen && item.content.phase_two_production?.approval_status === 'founder_review_not_published') ?? data.lessons[0], [chosen, data.lessons])
  const lessonJourney = data.journeys.find(item => item.id === lessonForReview?.journey_id)
  const position = data.lessons.findIndex(item => item.id === lessonForReview?.id)
  const navigate = (pageId?: string) => {
    setWorkbookPreview(null)
    setShowCurriculum(!pageId)
    if (pageId) setChosen(pageId)
    const params = new URLSearchParams(window.location.search)
    if (pageId) { params.set('lesson', pageId); params.delete('view') }
    else { params.delete('lesson'); params.set('view', 'curriculum') }
    window.history.pushState({}, '', '/learn/?' + params)
  }
  useEffect(() => {
    const back = () => {
      const params = new URLSearchParams(window.location.search)
      setChosen(params.get('lesson') ?? '1.1')
      setShowCurriculum(params.get('view') === 'curriculum')
      setWorkbookPreview(null)
    }
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])
  usePageStart(status !== 'ready' ? null : workbookPreview ? null : showCurriculum ? 'phase-two-curriculum' : 'phase-two:' + lessonForReview?.page_id)
  const phaseLinks = <nav className="curriculum-phase-links" aria-label="Academy phases">
    <a href="/learn/?review=phase-one&view=curriculum">Phase 1</a>
    <a href="/learn/?review=phase-two&view=curriculum" aria-current="page">Phase 2</a>
  </nav>

  if (status === 'ready' && workbookPreview) {
    return <div>{phaseLinks}<PhaseTwoWorkbook journey={workbookJourney}
      initialLesson={workbookJourney === Number(workbookPreview.split('.')[0]) ? Number(workbookPreview.split('.')[1]) : undefined}
      backLessonId={showCurriculum ? undefined : workbookPreview}
      availableJourneys={data.journeys.map(item => item.journey_number)}
      onSelectJourney={setWorkbookJourney}
      onBack={() => setWorkbookPreview(null)} /></div>
  }
  if (status === 'ready' && lessonForReview && !showCurriculum) {
    return <div>{phaseLinks}<nav className="curriculum-lesson-links" aria-label="Move through Phase Two">
      <button type="button" disabled={position <= 0} onClick={() => navigate(data.lessons[position - 1]?.page_id)}>Previous lesson</button>
      <button type="button" onClick={() => navigate()}>Your lessons</button>
      <button type="button" disabled={position >= data.lessons.length - 1} onClick={() => navigate(data.lessons[position + 1]?.page_id)}>Next lesson</button>
    </nav><PhaseTwoLessonExperience
      key={lessonForReview.id}
      pageId={lessonForReview.page_id}
      journeyTitle={lessonJourney?.title ?? 'AI Strategy and Business Opportunity'}
      lessonTitle={lessonForReview.title}
      purpose={lessonForReview.purpose}
      medium={lessonForReview.content.planned_media === 'video' ? 'video' : 'audio'}
      production={lessonForReview.content.phase_two_production}
      introVideo={lessonForReview.content.phase_two_media_plan?.avatar_introduction}
      guidedInstruction={lessonForReview.content.phase_two_media_plan?.guided_instruction}
      allowMediaReview
      onBackToLessons={() => navigate()}
      onOpenWorkbook={() => { setWorkbookJourney(Number(lessonForReview.page_id.split('.')[0])); setWorkbookPreview(lessonForReview.page_id) }}
      demoClips={['founder_approved','founder_review_pending'].includes(lessonForReview.content.phase_two_media_plan?.demonstration_clips?.approvalStatus ?? '')
        ? lessonForReview.content.phase_two_media_plan?.demonstration_clips?.clips
        : undefined}
      introAudio={lessonForReview.content.phase_two_media_plan?.audio_lesson?.generated_introduction?.review_status === 'founder_approved' &&
        lessonForReview.content.phase_two_media_plan?.audio_lesson?.generated_introduction?.voice_id === 'ac277b338cf64d8b9686784c43c563da'
          ? lessonForReview.content.phase_two_media_plan.audio_lesson.generated_introduction
          : undefined}
    /></div>
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

        {status === 'ready' && showCurriculum && <>
          {phaseLinks}
          <header className="p2-overview"><div>
            <p className="eyebrow">Phase Two</p>
            <h1>AI Professional and Builder Pathway</h1>
            <p>Choose a journey and lesson to continue your learning.</p>
          </div></header>
          <section aria-labelledby="p2-workbooks-heading">
            <h2 id="p2-workbooks-heading">My Workbooks</h2>
            <div className="workbook-links">{data.journeys.map(item => <button type="button" key={item.id}
              onClick={() => { setWorkbookJourney(item.journey_number); setWorkbookPreview(item.journey_number + '.1') }}>
              Workbook {item.journey_number} — Journey {item.journey_number}
            </button>)}</div>
          </section>
          {data.journeys.map(item => <section key={item.id} className="p2-journey-panel">
            <div><p className="eyebrow">Journey {item.journey_number}</p><h2>{item.title}</h2><p>{item.promise}</p>
              <div className="p2-lesson-nav">{data.lessons.filter(lesson => lesson.journey_id === item.id).map(lesson =>
                <button type="button" key={lesson.id} onClick={() => navigate(lesson.page_id)}>
                  <small>Lesson {lesson.page_id}</small><strong>{lesson.title}</strong>
                </button>)}</div>
            </div>
          </section>)}
        </>}

      </main>
      <footer className="p2-site-footer">AI Confidence Academy · People come first. AI is the tool. Confidence is the product. · AI assists, humans verify.</footer>
    </div>
  )
}
