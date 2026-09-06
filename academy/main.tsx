import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LessonView } from '../portal/src/components/LessonView'
import { JourneyIntroductionView } from '../portal/src/components/JourneyIntroductionView'
import type { Course, Journey, JourneyIntroduction, Lesson } from '../portal/src/types'
import '../portal/src/styles.css'
import './welcome-video.css'
import { GettingStarted } from './GettingStarted'

type Curriculum = { course: Course; journeys: Journey[]; lessons: Lesson[]; introductions: JourneyIntroduction[] }
type Welcome = { introduction: JourneyIntroduction; mediaUrl: string | null; captionUrl: string | null; companionAudioUrl: string | null; companionCaptionUrl: string | null }
async function read<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: 'no-store' })
  if (!response.ok) throw new Error('The academy could not load this material. Please try again.')
  return response.json()
}
function Academy() {
  const [data, setData] = useState<Curriculum | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [welcome, setWelcome] = useState<Welcome | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState(() => new URLSearchParams(window.location.search).get('view') === 'getting-started')
  useEffect(() => { read<Curriculum>('/api/academy/phase-one').then(setData).catch(e => setError(e.message)) }, [])
  async function openWelcome(id: string) {
    setBusy(true); setError('')
    try { setWelcome(await read<Welcome>('/api/academy/welcome/' + encodeURIComponent(id))); setLesson(null) }
    catch(e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  function openLesson(next: Lesson) { setSetup(false); setWelcome(null); setLesson(next); window.scrollTo(0, 0) }
  return <div className="portal-shell">
    <header className="portal-header"><a className="portal-brand" href="/">AI Confidence Academy</a><a href="/academy/phase-one/">Phase One</a></header>
    {error && <p role="alert" className="global-error">{error}</p>}
    {!data && !error && <p className="loading-screen">Loading Phase One…</p>}
    {data && (setup ? <GettingStarted onBack={() => setSetup(false)} onContinue={data.lessons.some(l => l.page_id === '1.1') ? () => openLesson(data.lessons.find(l => l.page_id === '1.1')!) : undefined} /> : welcome ? <JourneyIntroductionView {...welcome} onBack={() => setWelcome(null)} onContinue={() => { const next = data.lessons.find(l => l.journey_id === welcome.introduction.journey_id); if(next) openLesson(next) }} />
      : lesson ? <LessonView key={lesson.id} lesson={lesson} audioSrc={lesson.content.audio_path ? `/api/academy/lesson-audio/${encodeURIComponent(lesson.id)}` : undefined} reviewMode previousLesson={data.lessons[data.lessons.findIndex(l => l.id === lesson.id)-1]} nextLesson={data.lessons[data.lessons.findIndex(l => l.id === lesson.id)+1]} onBack={() => setLesson(null)} onOpenLesson={openLesson} onSave={async () => { throw new Error('Progress recording is unavailable during construction review.') }} />
      : <main className="portal-main"><section className="welcome-panel"><div><p className="eyebrow">Phase One</p><h1>{data.course.title}</h1><p>{data.course.summary}</p></div></section><section className="setup-entry"><p className="eyebrow">Before your first lesson</p><h2>Getting Started with ChatGPT</h2><p>Choose your device, send your first message, and practice asking for a change.</p><button onClick={() => { setSetup(true); window.scrollTo(0, 0) }}>Open the step-by-step guide</button></section><section className="course-panel">{data.journeys.map(journey => {
        const intro = data.introductions.find(i => i.journey_id === journey.id)
        return <article className="journey-card" key={journey.id}><div className="journey-number">Journey {journey.journey_number}</div><div className="journey-copy"><h2>{journey.title}</h2><p>{journey.promise}</p>{intro && <button className={`journey-welcome-button${intro.media_path ? " welcome-video-button" : ""}`} disabled={busy} onClick={() => openWelcome(intro.id)}>{intro.media_path ? <><span className="welcome-play-icon" aria-hidden="true">▶</span><span className="welcome-video-copy"><strong>Watch Journey {journey.journey_number} Welcome Video</strong><span className="welcome-video-title">{intro.content.title}</span></span></> : intro.content.title}</button>}<div className="lesson-list">{data.lessons.filter(l => l.journey_id === journey.id).map(l => <button className="lesson-row" key={l.id} onClick={() => openLesson(l)}><span>{l.page_id}</span><strong>{l.title}</strong><span>Open lesson</span></button>)}</div></div></article>
      })}</section></main>)}
  </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Academy /></React.StrictMode>)
