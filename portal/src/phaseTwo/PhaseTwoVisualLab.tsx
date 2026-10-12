import { useState } from 'react'
import type { PhaseTwoProducedLesson } from './PhaseTwoProducedLessonReview'
import './phaseTwoVisualLab.css'

type Case = PhaseTwoProducedLesson['worked_case']
const stages = [
  { short: 'Source', title: 'Start with the approved record', purpose: 'What do we actually know?' },
  { short: 'Draft', title: 'Spot the unsupported claim', purpose: 'An impressive answer still needs evidence.' },
  { short: 'Review', title: 'Check the claim against its source', purpose: 'Trace each important statement before anyone relies on it.' },
  { short: 'Correct', title: 'Make the result dependable', purpose: 'Keep what is supported. Qualify what is not.' },
] as const

/**
 * A guided, local step-through of the source-approved worked case.
 * No AI call or simulation of a real customer record takes place.
 */
export function PhaseTwoVisualLab({ workedCase }: { workedCase: Case }) {
  const [stage, setStage] = useState(0)
  const [answer, setAnswer] = useState<number | null>(null)
  const claimRows = workedCase.evidence_table
  const unsupported = claimRows.find(row => /no .*evidence|not establish|not supplied|no .*source/i.test(row.evidence))
    ?? claimRows[2]
  const options = [claimRows[0]?.claim, unsupported?.claim, claimRows[1]?.claim].filter(Boolean) as string[]
  const correctAnswer = options.indexOf(unsupported.claim)

  return (
    <section className="p2-visual-lab" aria-labelledby="p2-visual-title">
      <div className="p2-visual-lab-heading">
        <div><p className="p2-visual-kicker">See how the work happens</p>
          <h2 id="p2-visual-title">From a confident answer to a checked answer</h2>
          <p>Follow the report from source notes to a better decision. This is a fictional example you can examine one step at a time.</p>
        </div>
        <span className="p2-visual-lab-label">Guided example</span>
      </div>

      <div className="p2-visual-steps" role="group" aria-label="Choose demonstration step">
        {stages.map((item, index) => (
          <button type="button" key={item.short} aria-pressed={stage === index}
            onClick={() => { setStage(index); setAnswer(null) }}>
            <strong>{String(index+1).padStart(2,'0')}</strong><span>{item.short}</span>
          </button>
        ))}
      </div>

      <div className="p2-visual-stage" aria-live="polite" aria-atomic="true">
        <header><small>Step {stage+1} of 4</small><h3>{stages[stage].title}</h3><p>{stages[stage].purpose}</p></header>
        {stage === 0 && (
          <div className="p2-visual-workspace">
            <div className="p2-visual-window">
              <div className="p2-visual-window-top"><span aria-hidden="true">● ● ●</span><strong>Approved weekly notes</strong></div>
              <ul>{claimRows.filter(row => /present in/i.test(row.evidence)).map(row =>
                <li key={row.claim}><span className="p2-visual-dot" aria-hidden="true"/><strong>{row.claim}</strong><small>Check the original record</small></li>)}</ul>
            </div>
            <div className="p2-visual-side-note"><span aria-hidden="true">01</span><h4>Start with what is known</h4><p>Real responsibility begins with the source. These figures are part of this fictional exercise—not verified data from an actual business.</p></div>
          </div>
        )}
        {stage === 1 && (
          <div className="p2-visual-workspace">
            <div className="p2-visual-window">
              <div className="p2-visual-window-top"><span aria-hidden="true">● ● ●</span><strong>AI-assisted draft</strong></div>
              <p className="p2-visual-draft">{claimRows[0]?.claim} {claimRows[1]?.claim}</p>
              <p className="p2-visual-draft p2-visual-claim-warning"><span>Needs evidence</span>{unsupported.claim}</p>
              <p className="p2-visual-draft p2-visual-claim-warning"><span>Needs a baseline</span>{claimRows[3]?.claim}</p>
            </div>
            <div className="p2-visual-side-note"><span aria-hidden="true">02</span><h4>Fluency is not proof</h4><p>The draft sounds ready to share. But the on-time claim does not appear in the notes. A professional must stop before it becomes a reported fact.</p></div>
          </div>
        )}
        {stage === 2 && (
          <div className="p2-visual-checks">
            {claimRows.map(row => {
              const missing = /no .*evidence|not establish|not supplied|no .*source|no comparison/i.test(row.evidence)
              return <article key={row.claim}>
                <span className={missing?'p2-visual-status p2-visual-status-review':'p2-visual-status p2-visual-status-trace'}>{missing?'Review required':'Source to check'}</span>
                <h4>{row.claim}</h4>
                <p>{row.evidence}</p>
                <small>{row.action}</small>
              </article>
            })}
          </div>
        )}
        {stage === 3 && (
          <div className="p2-visual-workspace">
            <div className="p2-visual-window">
              <div className="p2-visual-window-top"><span aria-hidden="true">● ● ●</span><strong>Revised report</strong></div>
              <p className="p2-visual-revision">{workedCase.revised_example}</p>
            </div>
            <div className="p2-visual-side-note"><span aria-hidden="true">04</span><h4>A decision someone can defend</h4><p>AI can help rewrite the report. A human checks the records, removes the unsupported claim, and decides whether the revised version is ready to share.</p></div>
          </div>
        )}
      </div>

      <div className="p2-visual-actions">
        <button type="button" disabled={stage===0} onClick={() => {setStage(s=>Math.max(0,s-1));setAnswer(null)}}>Previous step</button>
        <span aria-label={`Step ${stage+1} of 4`}>{stages.map((step,i)=><span key={step.short} className={stage===i?'p2-visual-progress-dot active':'p2-visual-progress-dot'}/>)}</span>
        <button type="button" disabled={stage===3} onClick={() => {setStage(s=>Math.min(3,s+1));setAnswer(null)}}>Next step <span aria-hidden="true">→</span></button>
      </div>

      <div className="p2-visual-checkpoint">
        <div><p className="p2-visual-kicker">Try the decision</p><h3>Which claim must be withheld until there is more evidence?</h3></div>
        <div className="p2-visual-answers" role="group" aria-label="Choose the claim needing additional evidence">
          {options.map((option,index) => <button type="button" key={index}
            aria-pressed={answer===index} onClick={()=>setAnswer(index)}>{option}</button>)}
        </div>
        {answer !== null && <p role="status" className="p2-visual-feedback">
          {answer===correctAnswer
            ? 'Correct. That percentage was not established by the supplied records. Remove it or obtain an approved timing source.'
            : 'Look again at the source notes. Choose the statement that claims a result the notes cannot establish.'}
        </p>}
      </div>
      <div className="p2-visual-transfer">
        <span aria-hidden="true">↗</span>
        <p><strong>Your turn:</strong> Use the same judgment in your own project. Name one claim you can support, one you still need to check, and the person who owns the final decision.</p>
      </div>
    </section>
  )
}
