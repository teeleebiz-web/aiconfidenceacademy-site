import { useMemo, useState } from 'react'
import { PHASE_TWO_EVIDENCE_SECTIONS } from './phaseTwoProject'
import { PhaseTwoOrientation } from './PhaseTwoOrientation'
import {
  PhaseTwoProducedLessonReview,
  validProducedLesson,
  type PhaseTwoProducedLesson,
} from './PhaseTwoProducedLessonReview'
import './phaseTwoExperiencePreview.css'

export type PreviewJourney = {
  id: string
  journey_number: number
  title: string
  promise: string
}
export type PreviewLesson = {
  id: string
  journey_id: string
  page_id: string
  title: string
  purpose: string
  course_position: number
  journey_position: number
  content: {
    planned_media?: 'video' | 'audio'
    phase_two_production?: PhaseTwoProducedLesson
    phase_two?: {
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
  }
}

type PreviewTab = 'orientation' | 'lessons' | 'project'
const labels = [
  { key: 'teaching', title: 'Understand the work' },
  { key: 'worked_case', title: 'See a worked case' },
  { key: 'apply_to_project', title: 'Apply it to your project' },
  { key: 'ai_request', title: 'Practice with AI' },
  { key: 'verify_and_save', title: 'Review and save evidence' },
  { key: 'applied_completion_check', title: 'Demonstrate your judgment' },
] as const

/**
 * Protected owner-only learner walkthrough. Real draft teaching is supplied by
 * the owner-authorized review query. There is no simulated enrollment, no
 * fabricated progress, and no database writes from this component.
 */
export function PhaseTwoExperiencePreview({
  journeys,
  lessons,
}: {
  journeys: PreviewJourney[]
  lessons: PreviewLesson[]
}) {
  const [activeJourney, setActiveJourney] = useState(1)
  const [activeLesson, setActiveLesson] = useState('1.1')
  const [tab, setTab] = useState<PreviewTab>('lessons')
  const [copied, setCopied] = useState(false)
  const journey = journeys.find(item => item.journey_number === activeJourney)
  const journeyLessons = useMemo(
    () => lessons.filter(item => item.journey_id === journey?.id).sort((a,b) => a.journey_position - b.journey_position),
    [lessons, journey?.id],
  )
  const lesson = journeyLessons.find(item => item.page_id === activeLesson) ?? journeyLessons[0]
  const source = lesson?.content.phase_two
  const produced = lesson?.content.phase_two_production
  const productionExists = produced !== undefined
  const productionValid = productionExists && validProducedLesson(produced, lesson?.page_id ?? '')
  const guide = journeyLessons[0]?.content.phase_two?.journey
  const videoCount = journeyLessons.filter(item => item.content.planned_media === 'video').length
  const audioCount = journeyLessons.filter(item => item.content.planned_media === 'audio').length
  const nextLesson = lessons.find(item => item.course_position === (lesson?.course_position ?? 0) + 1)

  function chooseJourney(journeyNumber: number) {
    const j = journeys.find(item => item.journey_number === journeyNumber)
    const first = lessons.find(item => item.journey_id === j?.id && item.journey_position === 1)
    if (j && first) {
      setActiveJourney(journeyNumber)
      setActiveLesson(first.page_id)
      setCopied(false)
      setTab('lessons')
    }
  }
  function chooseLesson(pageId: string) {
    setActiveLesson(pageId)
    setCopied(false)
  }
  if (!journey || !lesson) return <p role="alert">The complete learner walkthrough is not available.</p>

  return (
    <div className="p2-walkthrough">
      <div className="p2-walkthrough-warning" role="note">
        <strong>Founder walkthrough · Unpublished</strong>
        <span>Review the learner's reading experience using the approved draft material. Lessons, access, saves and media playback are not activated here.</span>
      </div>
      <section className="p2-walkthrough-hero" aria-labelledby="p2-walkthrough-title">
        <p className="eyebrow">ACA AI Professional and Builder Pathway</p>
        <h2 id="p2-walkthrough-title">Make your AI capability useful.</h2>
        <p>Work through six journeys as you investigate an opportunity, improve a workflow, guide people through change, deliver value, strengthen operations and demonstrate the results.</p>
        <div className="p2-walkthrough-hero-meta">
          <span>6 journeys</span><span>36 lessons</span><span>One continuing project</span>
        </div>
      </section>
      <div className="p2-walkthrough-tabs" role="group" aria-label="Learner preview sections">
        <button type="button" aria-pressed={tab === 'orientation'} onClick={() => setTab('orientation')}>Orientation</button>
        <button type="button" aria-pressed={tab === 'lessons'} onClick={() => setTab('lessons')}>The lessons</button>
        <button type="button" aria-pressed={tab === 'project'} onClick={() => setTab('project')}>My Project Record</button>
      </div>

      {tab === 'orientation' ? (
        <PhaseTwoOrientation preview />
      ) : tab === 'project' ? (
        <section className="p2-walkthrough-project" aria-labelledby="p2-project-preview-title">
          <p className="eyebrow">One project · Six weeks</p>
          <h3 id="p2-project-preview-title">The work you build and keep</h3>
          <p>Choose Path A to improve an existing business process or Path B to develop a new offer, product or service. Both use the same 36 lessons. The actual project record preserves your revisions and supporting evidence as you work.</p>
          <div className="p2-walkthrough-paths">
            <div><strong>Path A</strong><span>Improve a process in a business or professional role.</span></div>
            <div><strong>Path B</strong><span>Develop a new offer, product or service.</span></div>
          </div>
          <h4>Evidence in your continuing project</h4>
          <ol className="p2-walkthrough-evidence">
            {PHASE_TWO_EVIDENCE_SECTIONS.map(item => (
              <li key={item.key}><strong>{item.label}</strong><small>Lesson connections: {item.lessons}</small></li>
            ))}
          </ol>
          <p className="p2-walkthrough-footnote">Read-only illustration. No project or learner record is created or saved in this walkthrough.</p>
        </section>
      ) : (
        <>
          <nav className="p2-walkthrough-journeys" aria-label="Six-journey learner roadmap">
            {journeys.slice().sort((a,b) => a.journey_number - b.journey_number).map(item => (
              <button key={item.id} type="button"
                aria-pressed={item.journey_number === activeJourney}
                onClick={() => chooseJourney(item.journey_number)}>
                <small>Journey {item.journey_number}</small><span>{item.title}</span>
              </button>
            ))}
          </nav>
          <section className="p2-walkthrough-journey" aria-labelledby="p2-walkthrough-journey-title">
            <div>
              <p className="eyebrow">Week {activeJourney} · Six guided lessons</p>
              <h3 id="p2-walkthrough-journey-title">{journey.title}</h3>
              <p>{journey.promise}</p>
              {guide && <p><strong>Journey result:</strong> {guide.journey_result}</p>}
              {guide && <p><strong>Independent practice:</strong> {guide.independent_application}</p>}
            </div>
            <div className="p2-walkthrough-media-balance">
              <strong>Lesson media plan</strong><span>{videoCount} video-led</span><span>{audioCount} audio-led</span>
              <small>All assignments are provisional.</small>
            </div>
          </section>
          <div className="p2-walkthrough-content">
            <nav className="p2-walkthrough-lesson-list" aria-label="Journey lesson selection">
              <h4>Choose a lesson</h4>
              {journeyLessons.map(item => (
                <button type="button" key={item.id}
                  aria-current={lesson.page_id === item.page_id ? 'page' : undefined}
                  onClick={() => chooseLesson(item.page_id)}>
                  <small>{item.page_id} · {item.content.planned_media === 'video' ? 'Video-led' : 'Audio-led'}</small>
                  <strong>{item.title}</strong>
                </button>
              ))}
            </nav>
            <article className="p2-walkthrough-lesson" aria-labelledby="p2-walkthrough-lesson-title">
              <header>
                <p className="eyebrow">Lesson {lesson.page_id} · Approximately 60 minutes</p>
                <h3 id="p2-walkthrough-lesson-title">{lesson.title}</h3>
                <p>{lesson.purpose}</p>
              </header>
              <section className="p2-walkthrough-media-placeholder" aria-label="Unproduced teaching media">
                <span aria-hidden="true">{lesson.content.planned_media === 'video' ? '▶' : '♪'}</span>
                <div><strong>{lesson.content.planned_media === 'video' ? 'Video-led instruction' : 'Audio-led instruction'}</strong>
                  <p>Media, captions and readable transcript will be placed here after production and review.</p>
                </div>
              </section>
              <section className="p2-walkthrough-rhythm" aria-labelledby="p2-walkthrough-rhythm-title">
                <h4 id="p2-walkthrough-rhythm-title">Your learning session</h4>
                <div>{(lesson.journey_position === 6
                  ? [['10 min','Integration'],['10 min','Challenge case'],['30 min','Test and revise'],['10 min','Evidence review']]
                  : [['15 min','Learn'],['10 min','Worked example'],['25 min','Apply'],['10 min','Verify']]
                ).map(([time,activity]) => <span key={activity}><strong>{time}</strong>{activity}</span>)}</div>
              </section>
              {productionExists && !productionValid ? (
                <p role="alert" className="p2-walkthrough-production-error">The instructional production draft for this lesson is incomplete. The approved source brief is preserved below for comparison.</p>
              ) : null}
              {productionValid ? (
                <PhaseTwoProducedLessonReview key={lesson.page_id} production={produced} />
              ) : null}
              {source && (!productionValid || productionExists === false) ? (
                <div className="p2-walkthrough-instruction">
                  {labels.map((part, index) => (
                    <section key={part.key}>
                      <small>{String(index + 1).padStart(2,'0')}</small>
                      <h4>{part.title}</h4>
                      {part.key === 'ai_request' ? (
                        <div className="p2-walkthrough-prompt">
                          <p>{source[part.key]}</p>
                          <button type="button" onClick={() => {
                            void navigator.clipboard?.writeText(source[part.key])
                              .then(() => setCopied(true))
                              .catch(() => setCopied(false))
                          }}>{copied ? 'Copied' : 'Copy AI request'}</button>
                        </div>
                      ) : <p>{source[part.key]}</p>}
                    </section>
                  ))}
                </div>
              ) : <p role="alert">This lesson's authorized teaching brief is missing.</p>}
              <footer className="p2-walkthrough-lesson-footer">
                <p>Complete the lesson's applied check using work you can explain and verify. The live project record will preserve the work and any meaningful revisions.</p>
                {nextLesson ? <button type="button" onClick={() => {
                  const nextJourney = journeys.find(j => j.id === nextLesson.journey_id)
                  if (nextJourney) setActiveJourney(nextJourney.journey_number)
                  chooseLesson(nextLesson.page_id)
                }}>Review lesson {nextLesson.page_id} →</button> : <span>End of Journey 6</span>}
              </footer>
            </article>
          </div>
        </>
      )}
    </div>
  )
}
