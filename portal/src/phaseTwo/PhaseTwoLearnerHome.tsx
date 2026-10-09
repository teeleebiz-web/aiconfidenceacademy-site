import { useEffect, useMemo, useState } from 'react'
import {
  loadPhaseTwoOutline, openPhaseTwoLesson,
  type PhaseTwoLessonOutline, type PhaseTwoOpenedLesson,
} from './phaseTwoLearnerApi'
import { PhaseTwoProjectWorkspace } from './PhaseTwoProjectWorkspace'
import { PhaseTwoOrientation } from './PhaseTwoOrientation'
import { PhaseTwoLessonExperience } from './PhaseTwoLessonExperience'
import { validProducedLesson } from './PhaseTwoProducedLessonReview'
import './phaseTwoLearnerHome.css'

type View = 'overview' | 'lesson' | 'project'
const sections = [
  { key: 'teaching', heading: 'Build the idea' },
  { key: 'worked_case', heading: 'Worked case' },
  { key: 'apply_to_project', heading: 'Apply it to your project' },
  { key: 'ai_request', heading: 'AI request' },
  { key: 'verify_and_save', heading: 'Verify and save' },
  { key: 'applied_completion_check', heading: 'Applied completion check' },
] as const

function formatRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * Phase Two learner surface, staged for the explicitly authorized Phase Two
 * enrollment route. It is not connected to the live landing page or enrollment.
 */
export function PhaseTwoLearnerHome({ enrollmentId }: { enrollmentId: string }) {
  const [lessons, setLessons] = useState<PhaseTwoLessonOutline[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('overview')
  const [opened, setOpened] = useState<PhaseTwoOpenedLesson | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    let alive = true
    setStatus('loading')
    void loadPhaseTwoOutline(enrollmentId).then(items => {
      if (!alive) return
      if (items.length !== 36 || new Set(items.map(x => x.page_id)).size !== 36) {
        setStatus('error')
        setError('The complete six-journey schedule is not ready for learner access.')
        return
      }
      setLessons(items)
      setStatus('ready')
    }).catch(() => {
      if (alive) {
        setStatus('error')
        setError('Your Phase Two lessons are not available. Please try again later.')
      }
    })
    return () => { alive = false }
  }, [enrollmentId])

  useEffect(() => {
    if (view !== 'lesson' || !opened) return
    const update = () => {
      const deadline = Date.parse(opened.closes_at)
      if (!Number.isFinite(deadline)) {
        setRemaining(0)
        setOpened(null)
        setView('overview')
        return
      }
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(next)
      if (!next) {
        setOpened(null)
        setView('overview')
        setError('Your lesson window has closed. Saved project work remains available.')
      }
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [opened, view])

  const journeys = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const journey = index + 1
    const items = lessons.filter(lesson => lesson.journey_number === journey)
    return { number: journey, title: items[0]?.journey_title ?? '', lessons: items }
  }), [lessons])

  const openLesson = async (lesson: PhaseTwoLessonOutline) => {
    if (!['available', 'active'].includes(lesson.access_status)) return
    setError('')
    setOpeningId(lesson.lesson_id)
    try {
      const result = await openPhaseTwoLesson(enrollmentId, lesson.lesson_id)
      setOpened(result)
      setRemaining(result.remaining_seconds)
      setView('lesson')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The lesson could not open.')
    } finally {
      setOpeningId(null)
    }
  }

  const teaching = opened?.lesson_content.phase_two
  const expanded = opened?.lesson_content.phase_two_production
  // A released, authenticated lesson uses the same complete learner-facing
  // instruction as the Academy's lesson reader, with the real project link.
  if (status === 'ready' && view === 'lesson' && opened &&
      validProducedLesson(expanded, opened.page_id)) {
    const journeyNumber = Number(opened.page_id.split('.')[0])
    const linkedJourney = journeys.find(item => item.number === journeyNumber)
    return <PhaseTwoLessonExperience
      pageId={opened.page_id}
      lessonTitle={opened.lesson_title}
      journeyTitle={linkedJourney?.title ?? 'AI Strategy and Business Opportunity'}
      purpose={opened.lesson_purpose}
      medium={opened.lesson_content.planned_media === 'video' ? 'video' : 'audio'}
      production={expanded}
      introVideo={opened.lesson_content.phase_two_media_plan?.avatar_introduction}
      enrollmentId={enrollmentId}
      remainingSeconds={remaining}
      onBackToLessons={() => { setOpened(null); setView('overview') }}
      onOpenProject={() => { setOpened(null); setView('project') }}
    />
  }
  return (
    <main className="phase-two-learner" id="phase-two-learning-home">
      <header className="p2-learner-header">
        <div>
          <p className="eyebrow">AI Confidence Academy · Phase Two</p>
          <h1>AI Professional and Builder Pathway</h1>
          <p>Six journeys. One continuing business project. Practice, review and demonstrate useful work.</p>
        </div>
        <div className="p2-learner-header-actions">
          <button type="button" aria-pressed={view === 'overview'}
            onClick={() => { setView('overview'); setOpened(null) }}>Your lessons</button>
          <button type="button" aria-pressed={view === 'project'}
            onClick={() => { setView('project'); setOpened(null) }}>My Project Record</button>
        </div>
      </header>

      {error ? <p role="alert" className="p2-learner-notice">{error}</p> : null}
      {status === 'loading' ? <p role="status">Loading your learning schedule…</p> : null}
      {status === 'error' ? <p role="status">Learner access is not yet available.</p> : null}

      {status === 'ready' && view === 'overview' ? (
        <>
          <details className="p2-orientation-disclosure">
            <summary>Course orientation and entry readiness</summary>
            <PhaseTwoOrientation />
          </details>
        <div className="p2-learner-journey-list">
          {journeys.map(journey => (
            <section key={journey.number} className="p2-learner-journey" aria-labelledby={`p2-journey-${journey.number}`}>
              <header>
                <span>Journey {journey.number} · Week {journey.number}</span>
                <h2 id={`p2-journey-${journey.number}`}>{journey.title}</h2>
              </header>
              <div className="p2-learner-lesson-list">
                {journey.lessons.map(lesson => {
                  const canOpen = lesson.access_status === 'available' || lesson.access_status === 'active'
                  return <article key={lesson.lesson_id} className="p2-learner-lesson-row">
                    <div>
                      <small>Lesson {lesson.page_id} · {lesson.planned_media === 'video' ? 'Video-led' : 'Audio-led'}</small>
                      <h3>{lesson.lesson_title}</h3>
                      <p>{lesson.access_status === 'scheduled'
                        ? 'Scheduled for release'
                        : lesson.access_status === 'active'
                          ? 'Continue your existing session'
                          : lesson.access_status === 'closed'
                            ? 'Lesson window closed; your project record remains available'
                            : 'Available to begin'}</p>
                    </div>
                    <button type="button" disabled={!canOpen || openingId !== null}
                      onClick={() => { void openLesson(lesson) }}>
                      {openingId === lesson.lesson_id ? 'Opening…'
                        : lesson.access_status === 'active' ? 'Resume lesson'
                          : canOpen ? 'Begin lesson' : 'Not open'}
                    </button>
                  </article>
                })}
              </div>
            </section>
          ))}
        </div>
        </>
      ) : null}

      {status === 'ready' && view === 'lesson' && opened ? (
        <article className="p2-opened-lesson">
          <header className="p2-opened-heading">
            <div>
              <p className="eyebrow">Lesson {opened.page_id} · Guided instruction</p>
              <h2>{opened.lesson_title}</h2>
              <p>{opened.lesson_purpose}</p>
            </div>
            <div className="p2-lesson-remaining" aria-label="Remaining lesson time">
              <strong>{formatRemaining(remaining)}</strong>
              <small>Time left in this access window</small>
            </div>
          </header>
          <section className="p2-opened-media" aria-label="Lesson media slot">
            <h3>{opened.lesson_content.planned_media === 'video' ? 'Video instruction' : 'Audio instruction'}</h3>
            <p>Approved lesson media, captions and transcripts will appear here after production review.</p>
          </section>
          {!teaching ? <p role="alert">This approved teaching brief is not available.</p> : (
            <div className="p2-opened-sections">
              {sections.map(({ key, heading }, index) => (
                <section key={key} aria-labelledby={`p2-opened-${key}`}>
                  <p className="p2-opened-number">{String(index + 1).padStart(2, '0')}</p>
                  <h3 id={`p2-opened-${key}`}>{heading}</h3>
                  {key === 'ai_request' ? <pre>{teaching[key]}</pre> : <p>{teaching[key]}</p>}
                </section>
              ))}
            </div>
          )}
          <footer className="p2-opened-footer">
            <p>Your project record stays available independently. Saving work does not automatically award completion.</p>
            <button type="button" onClick={() => { setOpened(null); setView('project') }}>Open My Project Record</button>
          </footer>
        </article>
      ) : null}

      {status === 'ready' && view === 'project' ? <PhaseTwoProjectWorkspace enrollmentId={enrollmentId} /> : null}
    </main>
  )
}
