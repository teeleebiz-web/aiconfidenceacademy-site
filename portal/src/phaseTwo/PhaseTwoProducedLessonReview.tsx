import { useState } from 'react'
import { PhaseTwoPracticeStudio } from './PhaseTwoPracticeStudio'
import { PhaseTwoDemoClips, type VisualDemoClip } from './PhaseTwoGuidedMedia'
import { PhaseTwoVisualLab } from './PhaseTwoVisualLab'
import { PhaseTwoNeedLab } from './PhaseTwoNeedLab'
import './phaseTwoProducedLesson.css'

export type PhaseTwoProducedLesson = {
  production_version: string
  approval_status: 'founder_review_not_published'
  curriculum_version: '2.0'
  lesson_id: string
  primary_media: 'audio' | 'video'
  title: string
  learner_promise: string
  pacing: Array<{ key: string; label: string; minutes: number }>
  outcomes: string[]
  teaching: Array<{ heading: string; paragraphs: string[]; think_prompt: string }>
  worked_case: {
    label: string
    setup: string
    evidence_table: Array<{ claim: string; evidence: string; action: string }>
    revised_example: string
    demonstration_steps: string[]
    question: string
  }
  application: Array<{ minutes: number; heading: string; instruction: string; evidence: string }>
  approved_ai_request: string
  responsibility_map_fields: string[]
  verification: Array<{ minutes: number; heading: string; prompt: string }>
  completion_criteria: string[]
  handoff: string
  editorial_notes: {
    status: string
    media: string
    source: string
    example_data?: string
  }
}

const expectedParts = ['teaching', 'worked_case', 'application', 'verification']
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

/**
 * This guard makes bad or incomplete production packages visible as a review
 * problem instead of showing them to a reviewer as an accepted lesson.
 */
export function validProducedLesson(value: unknown, pageId: string): value is PhaseTwoProducedLesson {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<PhaseTwoProducedLesson>
  if (p.lesson_id !== pageId || p.curriculum_version !== '2.0' ||
      p.approval_status !== 'founder_review_not_published' ||
      !isText(p.title) || !isText(p.learner_promise) ||
      !isText(p.approved_ai_request) || !isText(p.handoff) ||
      !['video', 'audio'].includes(p.primary_media ?? '')) return false
  if (!Array.isArray(p.pacing) || p.pacing.length !== 4 ||
      p.pacing.reduce((total, item) => total + (Number(item?.minutes) || 0), 0) !== 60 ||
      !expectedParts.every(key => p.pacing!.some(item => item?.key === key))) return false
  if (!Array.isArray(p.outcomes) || p.outcomes.length < 4 || !p.outcomes.every(isText)) return false
  if (!Array.isArray(p.teaching) || p.teaching.length < 3 ||
      !p.teaching.every(item => isText(item?.heading) && Array.isArray(item?.paragraphs) &&
        item.paragraphs.length > 0 && item.paragraphs.every(isText) && isText(item.think_prompt))) return false
  if (!p.worked_case || !isText(p.worked_case.label) || !isText(p.worked_case.setup) ||
      !isText(p.worked_case.revised_example) || !isText(p.worked_case.question) ||
      !Array.isArray(p.worked_case.evidence_table) ||
      p.worked_case.evidence_table.length < 3 ||
      !p.worked_case.evidence_table.every(row => isText(row.claim) && isText(row.evidence) && isText(row.action)) ||
      !Array.isArray(p.worked_case.demonstration_steps) ||
      p.worked_case.demonstration_steps.length < 3) return false
  if (!Array.isArray(p.application) || p.application.length < 3 ||
      p.application.reduce((total, step) => total + (Number(step?.minutes) || 0), 0) !== 25 ||
      !p.application.every(step => isText(step.heading) && isText(step.instruction) && isText(step.evidence))) return false
  if (!Array.isArray(p.verification) || p.verification.length < 3 ||
      p.verification.reduce((total, step) => total + (Number(step?.minutes) || 0), 0) !== 10 ||
      !p.verification.every(step => isText(step.heading) && isText(step.prompt))) return false
  if (!Array.isArray(p.responsibility_map_fields) || p.responsibility_map_fields.length < 4 ||
      !p.responsibility_map_fields.every(isText)) return false
  if (!Array.isArray(p.completion_criteria) || p.completion_criteria.length < 4 ||
      !p.completion_criteria.every(isText)) return false
  return !!p.editorial_notes && isText(p.editorial_notes.status) && isText(p.editorial_notes.media)
}

export function PhaseTwoProducedLessonReview({ production, learnerMode = false, enrollmentId, demoClips }: { production: PhaseTwoProducedLesson; learnerMode?: boolean; enrollmentId?: string; demoClips?: VisualDemoClip[] }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'unavailable'>('idle')
  const [showEvidence, setShowEvidence] = useState(true)
  const visualWalkthrough = learnerMode && production.lesson_id === '1.1'
  const needWalkthrough = learnerMode && production.lesson_id === '1.2'
  const useGuidedStudio = learnerMode && production.lesson_id === '1.1'
  const PracticeInstructionsContainer = useGuidedStudio ? 'details' : 'div'

  async function copyApprovedRequest() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyState('unavailable')
      return
    }
    try {
      await navigator.clipboard.writeText(production.approved_ai_request)
      setCopyState('copied')
    } catch {
      setCopyState('unavailable')
    }
  }

  return (
    <div className="p2-produced" aria-label={learnerMode ? "Lesson teaching and practice" : "Expanded instructional production draft"}>
      <section className="p2-produced-intro" aria-labelledby="p2-produced-overview-title">
        <p className="eyebrow">Lesson {production.lesson_id}</p>
        <h4 id="p2-produced-overview-title">What you will be able to demonstrate</h4>
        <p>{production.learner_promise}</p>
        <ul>{production.outcomes.map(item => <li key={item}>{item}</li>)}</ul>
        {!learnerMode && <p className="p2-produced-caution">Learning and recording durations are design targets until a timed pilot verifies them.</p>}
      </section>

      <section className="p2-produced-teaching" aria-labelledby="p2-produced-teaching-title">
        <div className="p2-produced-section-head">
          <span>01</span><div><p className="eyebrow">Teaching · 15 minutes</p>
            <h4 id="p2-produced-teaching-title">Develop professional judgment</h4></div>
        </div>
        {production.teaching.map((part, index) => (
          <div className="p2-produced-chapter" key={part.heading}>
            <p className="p2-produced-part-index">Teaching idea {index + 1} of {production.teaching.length}</p>
            <h5>{part.heading}</h5>
            {part.paragraphs.map((para, i) => <p key={i}>{para}</p>)}
            <div className="p2-produced-question"><strong>Consider this</strong><p>{part.think_prompt}</p></div>
          </div>
        ))}
      </section>

      <section className="p2-produced-case" aria-labelledby="p2-produced-case-title">
        <div className="p2-produced-section-head">
          <span>02</span><div><p className="eyebrow">Worked demonstration · 10 minutes</p>
            <h4 id="p2-produced-case-title">{production.worked_case.label}</h4></div>
        </div>
        <p>{production.worked_case.setup}</p>
        {visualWalkthrough && demoClips?.length === 4 && <PhaseTwoDemoClips clips={demoClips} />}
        {visualWalkthrough ? <PhaseTwoVisualLab workedCase={production.worked_case} /> : needWalkthrough ? <PhaseTwoNeedLab workedCase={production.worked_case} /> : <>
        <button className="p2-produced-evidence-toggle" type="button"
          aria-expanded={showEvidence} onClick={() => setShowEvidence(v => !v)}>
          {showEvidence ? 'Hide evidence review' : 'Show evidence review'}
        </button>
        {showEvidence && <div className="p2-produced-table-wrap">
          <table className="p2-produced-evidence-table">
            <caption>Compare each claim with its stated evidence and responsible next action.</caption>
            <thead><tr><th scope="col">Claim</th><th scope="col">What the record supports</th><th scope="col">Human review action</th></tr></thead>
            <tbody>{production.worked_case.evidence_table.map((row, i) => (
              <tr key={i}><td>{row.claim}</td><td>{row.evidence}</td><td>{row.action}</td></tr>
            ))}</tbody>
          </table>
        </div>}
        <div className="p2-produced-example">
          <strong>Revised example</strong><p>{production.worked_case.revised_example}</p>
        </div>
        <h5>Follow the reviewer’s decision</h5>
        <ol>{production.worked_case.demonstration_steps.map((step,i) => <li key={i}>{step}</li>)}</ol>
        <div className="p2-produced-question"><strong>Apply the judgment</strong><p>{production.worked_case.question}</p></div>
        </>}
      </section>

      <section className="p2-produced-apply" aria-labelledby="p2-produced-apply-title">
        <div className="p2-produced-section-head">
          <span>03</span><div><p className="eyebrow">Project application · 25 minutes</p>
            <h4 id="p2-produced-apply-title">Develop your continuing project</h4></div>
        </div>
        <p>Keep your work together in your Project Record. You will use it again in the lessons ahead.</p>
        {learnerMode && production.lesson_id === '1.1' && (
          <PhaseTwoPracticeStudio approvedAiRequest={production.approved_ai_request} enrollmentId={enrollmentId} />
        )}
        <PracticeInstructionsContainer className={useGuidedStudio ? 'p2-produced-optional-instructions' : undefined}>
          {useGuidedStudio && <summary>Read the detailed activity instructions</summary>}
        <ol className="p2-produced-tasklist">{production.application.map((task, i) => (
          <li key={i}>
            <header><h5>{task.heading}</h5><small>{task.minutes} minutes</small></header>
            <p>{task.instruction}</p><p className="p2-produced-evidence-label"><strong>Keep:</strong> {task.evidence}</p>
          </li>
        ))}</ol>
        <div className="p2-produced-map">
          <h5>Responsibility-map reference</h5>
          <ul>{production.responsibility_map_fields.map(field => <li key={field}>{field}</li>)}</ul>
        </div>
        </PracticeInstructionsContainer>
        {!(learnerMode && production.lesson_id === '1.1') && <div className="p2-produced-ai-request">
          <div><h5>Approved AI request</h5><button type="button" onClick={() => { void copyApprovedRequest() }}>
            {copyState === 'copied' ? 'Copied' : 'Copy request'}</button></div>
          <p>{production.approved_ai_request}</p>
          {copyState === 'unavailable' ? <p role="status">Copy was unavailable. Select the text above to copy it.</p> : null}
        </div>}
      </section>

      <section className="p2-produced-check" aria-labelledby="p2-produced-check-title">
        <div className="p2-produced-section-head">
          <span>04</span><div><p className="eyebrow">Verification and applied check · 10 minutes</p>
            <h4 id="p2-produced-check-title">Show the evidence behind your judgment</h4></div>
        </div>
        <ol className="p2-produced-verify">{production.verification.map((item,i) =>
          <li key={i}><strong>{item.heading}</strong><small>{item.minutes} minutes</small><p>{item.prompt}</p></li>
        )}</ol>
        <div className="p2-produced-criteria">
          <h5>Completion evidence to be reviewed</h5>
          <ul>{production.completion_criteria.map(item => <li key={item}>{item}</li>)}</ul>
          <p>{learnerMode ? 'Use these criteria to check your work before you submit it for review.' : 'These criteria describe evidence, not automatic completion credit. Final review remains a separate human-approved process.'}</p>
        </div>
        <div className="p2-produced-handoff">
          <strong>Carry the work forward</strong><p>{production.handoff}</p>
        </div>
      </section>

      {!learnerMode && <footer className="p2-produced-source">
        <p><strong>Production status:</strong> {production.editorial_notes.status}</p>
        <p><strong>Media status:</strong> {production.editorial_notes.media}</p>
        {production.editorial_notes.example_data && <p>{production.editorial_notes.example_data}</p>}
        <p>{production.editorial_notes.source}</p>
      </footer>}
    </div>
  )
}
