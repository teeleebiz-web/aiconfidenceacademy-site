import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LessonView } from '../portal/src/components/LessonView'
import { JourneyIntroductionView } from '../portal/src/components/JourneyIntroductionView'
import type { Course, Journey, JourneyIntroduction, Lesson } from '../portal/src/types'
import '../portal/src/styles.css'
import './welcome-video.css'
import { GettingStarted } from './GettingStarted'
import { Workbook } from './workbook/Workbook'

type Curriculum = { course: Course; journeys: Journey[]; lessons: Lesson[]; introductions: JourneyIntroduction[] }
type Welcome = { introduction: JourneyIntroduction; mediaUrl: string | null; captionUrl: string | null; companionAudioUrl: string | null; companionCaptionUrl: string | null }
async function read<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: 'no-store' })
  if (!response.ok) throw new Error('The academy could not load this material. Please try again.')
  return response.json()
}
function Academy() {
  const requestedWorkbook = new URLSearchParams(window.location.search).get('workbook')
  const workbookKey = requestedWorkbook === 'journey-three' ? 'journey-three' : 'journey-one'
  const isWorkbook = requestedWorkbook === 'journey-one' || requestedWorkbook === 'journey-three'
  const [data, setData] = useState<Curriculum | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [welcome, setWelcome] = useState<Welcome | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState(() => new URLSearchParams(window.location.search).get('view') === 'getting-started')
  useEffect(() => { if (isWorkbook) return; read<Curriculum>('/api/academy/phase-one').then(async curriculum => {
    setData(curriculum)
    const params = new URLSearchParams(window.location.search)
    const requested = curriculum.lessons.find(item => item.page_id === params.get('lesson'))
    if (requested) { setSetup(false); setLesson(requested); return }
    if (params.get('journey') === '3') {
      const journey = curriculum.journeys.find(item => item.journey_number === 3)
      const firstLesson = curriculum.lessons.find(item => item.journey_id === journey?.id && item.page_id === '3.1')
      if (!firstLesson) throw new Error('Journey Three could not load. Please try again.')
      openLesson(firstLesson)
      return
    }
    if (params.get('journey') === '2') {
      const journey = curriculum.journeys.find(item => item.journey_number === 2)
      const firstLesson = curriculum.lessons.find(item => item.journey_id === journey?.id && item.page_id === '2.1')
      if (!firstLesson) throw new Error('Journey Two could not load. Please try again.')
      openLesson(firstLesson)
    }
  }).catch(e => setError(e.message)) }, [])
  async function openWelcome(id: string, journeyNumber?: number) {
    if (journeyNumber === 3) {
      const firstLesson = data?.lessons.find(item => item.page_id === '3.1' && item.journey_id === data.journeys.find(journey => journey.journey_number === 3)?.id)
      if (firstLesson) { openLesson(firstLesson); return }
      setError('Journey Three could not load. Please try again.'); return
    }
    if (journeyNumber === 2) {
      const firstLesson = data?.lessons.find(item => item.page_id === '2.1' && item.journey_id === data.journeys.find(journey => journey.journey_number === 2)?.id)
      if (firstLesson) { openLesson(firstLesson); return }
      setError('Journey Two could not load. Please try again.'); return
    }
    setBusy(true); setError('')
    try {
      const next = await read<Welcome>('/api/academy/welcome/' + encodeURIComponent(id))
      setSetup(false); setWelcome(next); setLesson(null)
    }
    catch(e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  function openLesson(next: Lesson) {
    const params = new URLSearchParams(window.location.search)
    if (next.page_id.startsWith('2.') || params.get('lesson')?.startsWith('2.') || params.get('journey') === '2') {
      window.history.replaceState(null, '', '/academy/phase-one/?lesson=' + encodeURIComponent(next.page_id))
    }
    if (next.page_id.startsWith('3.') || params.get('journey') === '3' || params.get('lesson')?.startsWith('3.')) window.history.replaceState(null, '', '/academy/phase-one/?lesson=' + encodeURIComponent(next.page_id))
    setSetup(false); setWelcome(null); setLesson(next); window.scrollTo(0, 0)
  }
  return <div className="portal-shell">
    <header className="portal-header"><a className="portal-brand" href="/">AI Confidence Academy</a><a href="/academy/phase-one/">Phase One</a></header>
    {error && <p role="alert" className="global-error">{error}</p>}
    {isWorkbook && <Workbook key={workbookKey} workbookKey={workbookKey} lessonId={new URLSearchParams(window.location.search).get('lesson')} />}
    {!isWorkbook && !data && !error && <p className="loading-screen">Loading Phase One…</p>}
    {!isWorkbook && data && (setup ? <GettingStarted onBack={() => setSetup(false)} onContinue={data.lessons.some(l => l.page_id === '1.1') ? () => openLesson(data.lessons.find(l => l.page_id === '1.1')!) : undefined} /> : welcome ? <JourneyIntroductionView {...welcome} workbookHref={welcome.introduction.content.roadmap[0]?.page_id === '3.1' ? '/academy/phase-one/?workbook=journey-three&lesson=3.1' : undefined} onBack={() => setWelcome(null)} onContinue={() => { const next = data.lessons.find(l => l.journey_id === welcome.introduction.journey_id); if(next) openLesson(next) }} />
      : lesson ? <>
        <LessonView key={lesson.id} lesson={lesson} workbookHref={/^1\.[1-6]$/.test(lesson.page_id) ? `/academy/phase-one/?workbook=journey-one&lesson=${encodeURIComponent(lesson.page_id)}` : lesson.page_id === '3.1' ? '/academy/phase-one/?workbook=journey-three&lesson=3.1' : undefined} videoSrc={lesson.content.video_path ? `/api/academy/lesson-video/${encodeURIComponent(lesson.id)}?v=${encodeURIComponent(lesson.content.video_path)}` : undefined} audioSrc={lesson.content.audio_path ? `/api/academy/lesson-audio/${encodeURIComponent(lesson.id)}?v=${encodeURIComponent(lesson.content.audio_path)}` : undefined} audioPreload={data.journeys.some(journey => journey.journey_number === 2 && journey.id === lesson.journey_id) ? 'metadata' : 'none'} reviewMode previousLesson={data.lessons[data.lessons.findIndex(l => l.id === lesson.id)-1]} nextLesson={data.lessons[data.lessons.findIndex(l => l.id === lesson.id)+1]} onBack={() => setLesson(null)} onOpenLesson={openLesson} onSave={async () => { throw new Error('Progress recording is unavailable during construction review.') }} />
      </>
      : <main className="portal-main"><section className="welcome-panel"><div><p className="eyebrow">Phase One</p><h1>{data.course.title}</h1><p>{data.course.summary}</p></div></section><section className="setup-entry"><p className="eyebrow">Before your first lesson</p><h2>Getting Started with ChatGPT</h2><p>Choose your device, send your first message, and practice asking for a change.</p><button onClick={() => { setSetup(true); window.scrollTo(0, 0) }}>Open the step-by-step guide</button></section><section className="course-panel">{data.journeys.map(journey => {
        const intro = journey.journey_number === 3 ? undefined : data.introductions.find(i => i.journey_id === journey.id)
        return <article className="journey-card" key={journey.id}><div className="journey-number">Journey {journey.journey_number}</div><div className="journey-copy"><h2>{journey.title}</h2><p>{journey.promise}</p>{intro && <button className={`journey-welcome-button${intro.media_path ? " welcome-video-button" : ""}`} disabled={busy} onClick={() => openWelcome(intro.id, journey.journey_number)}>{intro.media_path ? <><span className="welcome-play-icon" aria-hidden="true">▶</span><span className="welcome-video-copy"><strong>Watch Journey {journey.journey_number} Welcome Video</strong><span className="welcome-video-title">{intro.content.title}</span></span></> : intro.content.title}</button>}{journey.journey_number === 1 && <a className="workbook-entry-link" href="/academy/phase-one/?workbook=journey-one">Open Journey One Workbook</a>}<div className="lesson-list">{data.lessons.filter(l => l.journey_id === journey.id).map(l => <button className="lesson-row" key={l.id} onClick={() => openLesson(l)}><span>{l.page_id}</span><strong>{l.title}</strong><span>Open lesson</span></button>)}</div></div></article>
      })}</section></main>)}
  </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Academy /></React.StrictMode>)
