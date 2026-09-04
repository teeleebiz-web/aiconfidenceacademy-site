import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import sealUrl from '../../aca-official-seal.png'
import { Dashboard } from './components/Dashboard'
import { JourneyIntroductionView } from './components/JourneyIntroductionView'
import { LessonView } from './components/LessonView'
import { SignIn } from './components/SignIn'
import { supabase } from './lib/supabase'
import type { Enrollment, Journey, JourneyIntroduction, Lesson, LessonProgress } from './types'

type PortalData = {
  enrollment: Enrollment | null
  journeys: Journey[]
  lessons: Lesson[]
  progress: LessonProgress[]
  introductions: JourneyIntroduction[]
  learnerName: string
}

const emptyPortalData: PortalData = {
  enrollment: null,
  journeys: [],
  lessons: [],
  progress: [],
  introductions: [],
  learnerName: '',
}

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalData, setPortalData] = useState<PortalData>(emptyPortalData)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [selectedIntroduction, setSelectedIntroduction] = useState<JourneyIntroduction | null>(null)
  const [introductionMediaUrl, setIntroductionMediaUrl] = useState<string | null>(null)
  const [introductionCaptionUrl, setIntroductionCaptionUrl] = useState<string | null>(null)
  const [companionAudioUrl, setCompanionAudioUrl] = useState<string | null>(null)
  const [companionCaptionUrl, setCompanionCaptionUrl] = useState<string | null>(null)
  const [artifact, setArtifact] = useState('')
  const [error, setError] = useState('')
  const [reviewMode, setReviewMode] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setPortalData(emptyPortalData)
      setReviewMode(false)
      return
    }

    loadPortal(session.user.id)
  }, [session])

  async function loadPortal(userId: string) {
    setLoading(true)
    setError('')

    const [profileResult, enrollmentResult, ownerResult] = await Promise.all([
      supabase.from('profiles').select('first_name, display_name').eq('id', userId).maybeSingle(),
      supabase
        .from('enrollments')
        .select('id, learner_id, course_id, status, starts_at, access_expires_at, course:courses(id, code, title, summary)')
        .eq('learner_id', userId)
        .in('status', ['active', 'completed'])
        .maybeSingle(),
      supabase.rpc('is_aca_curriculum_owner'),
    ])

    if (profileResult.error || enrollmentResult.error || ownerResult.error) {
      setError(
        profileResult.error?.message ??
          enrollmentResult.error?.message ??
          ownerResult.error?.message ??
          'Unable to load ACA access.',
      )
      setLoading(false)
      return
    }

    setReviewMode(ownerResult.data === true)

    const enrollment = enrollmentResult.data as unknown as Enrollment | null

    if (!enrollment) {
      setPortalData({
        ...emptyPortalData,
        learnerName: profileResult.data?.first_name ?? profileResult.data?.display_name ?? '',
      })
      setLoading(false)
      return
    }

    const [journeyResult, lessonResult, progressResult, introductionResult] = await Promise.all([
      supabase
        .from('course_journeys')
        .select('id, course_id, journey_number, week_number, title, promise, release_offset_days, status')
        .eq('course_id', enrollment.course_id)
        .order('journey_number'),
      supabase
        .from('lessons')
        .select('id, course_id, journey_id, page_id, title, purpose, estimated_minutes, course_position, journey_position, unlock_offset_days, status, content')
        .eq('course_id', enrollment.course_id)
        .order('course_position'),
      supabase
        .from('lesson_progress')
        .select('id, lesson_id, status, last_step, artifact_saved')
        .eq('enrollment_id', enrollment.id),
      supabase
        .from('journey_introductions')
        .select('id, journey_id, media_kind, media_path, caption_path, companion_audio_path, companion_caption_path, duration_seconds, content, status, source_version'),
    ])

    const queryError = journeyResult.error ?? lessonResult.error ?? progressResult.error ?? introductionResult.error
    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    setPortalData({
      enrollment,
      journeys: (journeyResult.data ?? []) as Journey[],
      lessons: (lessonResult.data ?? []) as unknown as Lesson[],
      progress: (progressResult.data ?? []) as LessonProgress[],
      introductions: (introductionResult.data ?? []) as unknown as JourneyIntroduction[],
      learnerName: profileResult.data?.first_name ?? profileResult.data?.display_name ?? '',
    })
    setLoading(false)
  }

  async function requestSignInLink(email: string) {
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/learn/`,
      },
    })

    if (signInError) throw signInError
  }

  async function signInWithPassword(email: string, password: string) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) throw signInError
  }

  async function openLesson(lesson: Lesson) {
    setError('')
    setSelectedIntroduction(null)
    setSelectedLesson(lesson)
    setArtifact('')

    if (!portalData.enrollment || reviewMode) return

    const { data } = await supabase
      .from('learner_artifacts')
      .select('content')
      .eq('enrollment_id', portalData.enrollment.id)
      .eq('lesson_id', lesson.id)
      .eq('artifact_kind', 'reflection')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const content = data?.content as { response?: string } | null
    setArtifact(content?.response ?? '')
  }

  async function openIntroduction(introduction: JourneyIntroduction) {
    setError('')
    setSelectedLesson(null)
    setSelectedIntroduction(introduction)
    setIntroductionMediaUrl(null)
    setIntroductionCaptionUrl(null)
    setCompanionAudioUrl(null)
    setCompanionCaptionUrl(null)

    if (!introduction.media_path && !introduction.companion_audio_path) return

    const [mediaResult, captionResult, audioResult, audioCaptionResult] = await Promise.all([
      introduction.media_path
        ? supabase.storage.from('aca-learning-media').createSignedUrl(introduction.media_path, 3600)
        : Promise.resolve({ data: null, error: null }),
      introduction.caption_path
        ? supabase.storage.from('aca-learning-media').createSignedUrl(introduction.caption_path, 3600)
        : Promise.resolve({ data: null, error: null }),
      introduction.companion_audio_path
        ? supabase.storage.from('aca-learning-media').createSignedUrl(introduction.companion_audio_path, 3600)
        : Promise.resolve({ data: null, error: null }),
      introduction.companion_caption_path
        ? supabase.storage.from('aca-learning-media').createSignedUrl(introduction.companion_caption_path, 3600)
        : Promise.resolve({ data: null, error: null }),
    ])

    if (mediaResult.error || audioResult.error) {
      setError('One of the welcome recordings is temporarily unavailable. Both transcripts remain available below.')
    }

    setIntroductionMediaUrl(mediaResult.data?.signedUrl ?? null)
    setIntroductionCaptionUrl(captionResult.data?.signedUrl ?? null)
    setCompanionAudioUrl(audioResult.data?.signedUrl ?? null)
    setCompanionCaptionUrl(audioCaptionResult.data?.signedUrl ?? null)
  }

  function continueFromIntroduction() {
    if (!selectedIntroduction) return
    const firstLesson = portalData.lessons.find(
      (lesson) => lesson.journey_id === selectedIntroduction.journey_id,
    )

    if (firstLesson) void openLesson(firstLesson)
  }

  async function saveLesson(response: string) {
    if (!session?.user || !portalData.enrollment || !selectedLesson) {
      throw new Error('Your secure session has ended. Please sign in again.')
    }

    if (reviewMode) {
      throw new Error('Owner review mode is read-only and does not alter learner progress.')
    }

    const identity = {
      learner_id: session.user.id,
      enrollment_id: portalData.enrollment.id,
      course_id: portalData.enrollment.course_id,
      lesson_id: selectedLesson.id,
    }

    const { data: existingArtifact, error: artifactLookupError } = await supabase
      .from('learner_artifacts')
      .select('id')
      .eq('enrollment_id', portalData.enrollment.id)
      .eq('lesson_id', selectedLesson.id)
      .eq('artifact_kind', 'reflection')
      .limit(1)
      .maybeSingle()

    if (artifactLookupError) throw artifactLookupError

    const artifactResult = existingArtifact
      ? await supabase
          .from('learner_artifacts')
          .update({ content: { response }, title: `My ACA Lesson ${selectedLesson.page_id} Evidence` })
          .eq('id', existingArtifact.id)
      : await supabase.from('learner_artifacts').insert({
          ...identity,
          artifact_kind: 'reflection',
          title: `My ACA Lesson ${selectedLesson.page_id} Evidence`,
          content: { response },
        })

    if (artifactResult.error) throw artifactResult.error

    const { error: progressError } = await supabase.from('lesson_progress').upsert(
      {
        ...identity,
        status: 'completed',
        last_step: 7,
        artifact_saved: true,
        required_revision_completed: true,
        evidence_summary: `Saved Lesson ${selectedLesson.page_id} evidence after guided practice and revision.`,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'enrollment_id,lesson_id' },
    )

    if (progressError) throw progressError
    setArtifact(response)
    await loadPortal(session.user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSelectedLesson(null)
    setSelectedIntroduction(null)
  }

  if (loading) {
    return <div className="loading-screen">Preparing your ACA learning space…</div>
  }

  if (!session) {
    return (
      <SignIn
        onRequestLink={requestSignInLink}
        onPasswordSignIn={signInWithPassword}
      />
    )
  }

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <a href="/" className="portal-brand" aria-label="AI Confidence Academy home">
          <img src={sealUrl} alt="" width="52" height="52" />
          <span>
            <strong>AI Confidence Academy</strong>
            <small>Learner Portal</small>
          </span>
        </a>
        <button className="quiet-button" type="button" onClick={signOut}>
          Sign out
        </button>
      </header>

      {error ? <p className="global-error" role="alert">{error}</p> : null}

      {selectedIntroduction ? (
        <JourneyIntroductionView
          introduction={selectedIntroduction}
          mediaUrl={introductionMediaUrl}
          captionUrl={introductionCaptionUrl}
          companionAudioUrl={companionAudioUrl}
          companionCaptionUrl={companionCaptionUrl}
          onBack={() => setSelectedIntroduction(null)}
          onContinue={continueFromIntroduction}
        />
      ) : selectedLesson ? (
        <LessonView
          key={selectedLesson.id}
          lesson={selectedLesson}
          progress={portalData.progress.find((item) => item.lesson_id === selectedLesson.id)}
          initialArtifact={artifact}
          reviewMode={reviewMode}
          previousLesson={portalData.lessons[portalData.lessons.findIndex((item) => item.id === selectedLesson.id) - 1]}
          nextLesson={portalData.lessons[portalData.lessons.findIndex((item) => item.id === selectedLesson.id) + 1]}
          onBack={() => setSelectedLesson(null)}
          onSave={saveLesson}
          onOpenLesson={openLesson}
        />
      ) : portalData.enrollment ? (
        <Dashboard
          enrollment={portalData.enrollment}
          journeys={portalData.journeys}
          lessons={portalData.lessons}
          progress={portalData.progress}
          introductions={portalData.introductions}
          learnerName={portalData.learnerName}
          reviewMode={reviewMode}
          onOpenLesson={openLesson}
          onOpenIntroduction={openIntroduction}
        />
      ) : (
        <main className="access-shell">
          <section className="auth-card">
            <p className="eyebrow">Account recognized</p>
            <h1>Your enrollment is not active yet.</h1>
            <p className="lede">
              Your secure ACA account is working. Course access will appear here after your
              enrollment is confirmed.
            </p>
            <a className="primary-link" href="/contact">Contact ACA support</a>
          </section>
        </main>
      )}
    </div>
  )
}
