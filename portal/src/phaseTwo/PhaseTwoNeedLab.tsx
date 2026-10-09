import { useState } from 'react'
import type { PhaseTwoProducedLesson } from './PhaseTwoProducedLessonReview'
import './phaseTwoNeedLab.css'

type Case = PhaseTwoProducedLesson['worked_case']
const stages = [
  { label: 'Notice', heading: 'Begin with the symptom', purpose: 'What has someone actually observed?' },
  { label: 'Understand', heading: 'See the person and the need', purpose: 'Describe the result they want before naming a tool.' },
  { label: 'Investigate', heading: 'Test possible causes', purpose: 'Three plausible explanations need different evidence.' },
  { label: 'Decide', heading: 'Choose the next responsible step', purpose: 'A provisional decision is better than a confident guess.' },
] as const

const audienceView = [
  { label: 'Person', value: 'A customer looking for a delivery update' },
  { label: 'Situation', value: 'The support team receives repeated delivery questions' },
  { label: 'Need', value: 'Reliable, understandable delivery information' },
  { label: 'Barrier', value: 'Not yet established; access, policy or routing may be involved' },
  { label: 'Desired result', value: 'A correct answer without avoidable delay or confusion' },
]
const neutralQuestions = [
  'When you need an update, where do you look first?',
  'What information is hardest to find or understand?',
  'What happens when your first attempt does not answer the question?',
  'Which part of the current process is most confusing?',
  'What would make the answer more useful to you?',
]

/** Visual decision walkthrough grounded in Lesson 1.2's fictional approved case. */
export function PhaseTwoNeedLab({ workedCase }: { workedCase: Case }) {
  const [stage, setStage] = useState(0)
  const [answer, setAnswer] = useState<number | null>(null)
  const causeRows = workedCase.evidence_table.slice(1)
  const statements = [
    workedCase.evidence_table[0]?.claim ?? 'The delivery topic appears in several notes.',
    'Every customer wants an AI chatbot.',
    causeRows[0]?.claim ?? 'The current information may be missing.',
  ]
  const advance = (value: number) => { setStage(value); setAnswer(null) }
  return (
    <section className="p2-need-lab" aria-labelledby="p2-need-lab-title">
      <header className="p2-need-lab-heading">
        <div>
          <p className="eyebrow">See how a business need is discovered</p>
          <h2 id="p2-need-lab-title">Find the problem before choosing the technology</h2>
          <p>Follow the same customer-service case through observation, audience needs, competing explanations and a responsible next step.</p>
        </div>
        <span>Guided example</span>
      </header>

      <nav className="p2-need-lab-tabs" aria-label="Investigation steps">
        {stages.map((item,i) => <button type="button" key={item.label} aria-pressed={stage===i} onClick={()=>advance(i)}>
          <strong>{String(i+1).padStart(2,'0')}</strong><span>{item.label}</span>
        </button>)}
      </nav>

      <div className="p2-need-lab-stage" aria-live="polite">
        <p className="p2-need-lab-step">Step {stage+1} of 4</p>
        <h3>{stages[stage].heading}</h3>
        <p className="p2-need-lab-purpose">{stages[stage].purpose}</p>
        {stage===0 && <div className="p2-need-lab-observation">
          <div className="p2-need-lab-notes">
            <div className="p2-need-lab-windowbar"><span aria-hidden="true">● ● ●</span>Support notes</div>
            <p>{workedCase.setup}</p>
            <div className="p2-need-lab-evidence-tag">Observed topic</div>
            <blockquote>{workedCase.evidence_table[0]?.claim}</blockquote>
          </div>
          <aside><span>01</span><h4>The evidence boundary</h4><p>A repeated question is a symptom. It is not proof that customers need a chatbot, or that a particular cause explains the repetition.</p></aside>
        </div>}

        {stage===1 && <div className="p2-need-lab-audience">
          {audienceView.map((item,i) => <div key={item.label}>
            <span>{String(i+1).padStart(2,'0')}</span><strong>{item.label}</strong><p>{item.value}</p>
          </div>)}
          <p className="p2-need-lab-audience-note">This is an example of an Audience-Need View. Confirm the person's real experience before treating the barrier as a finding.</p>
        </div>}

        {stage===2 && <div className="p2-need-lab-causes">
          {causeRows.map((row,i)=><article key={row.claim}>
            <span>Possible cause {i+1}</span>
            <h4>{row.claim}</h4>
            <p>{row.evidence}</p>
            <div><strong>How to check:</strong> {row.action}</div>
          </article>)}
          <p>Different explanations can lead to different solutions. The useful tool comes after the evidence, not before it.</p>
        </div>}

        {stage===3 && <div className="p2-need-lab-decision">
          <div><p className="p2-need-lab-decision-kicker">Provisional need statement</p><blockquote>{workedCase.revised_example}</blockquote></div>
          <section aria-labelledby="p2-need-questions">
            <h4 id="p2-need-questions">Five neutral questions to inspire your own</h4>
            <ol>{neutralQuestions.map(q=><li key={q}>{q}</li>)}</ol>
            <p>Use authorized conversations or reliable source review. Do not pretend an AI response is actual customer feedback.</p>
          </section>
        </div>}
      </div>

      <div className="p2-need-lab-controls">
        <button type="button" disabled={stage===0} onClick={()=>advance(Math.max(0,stage-1))}>Previous step</button>
        <div aria-label={`Step ${stage+1} of four`}>{stages.map((item,i)=><span key={item.label} className={i===stage?'active':''}/>)}</div>
        <button type="button" disabled={stage===3} onClick={()=>advance(Math.min(3,stage+1))}>Next step <span aria-hidden="true">→</span></button>
      </div>

      <div className="p2-need-lab-check">
        <h3>Which of these statements is an observation rather than an assumption?</h3>
        <div role="group" aria-label="Identify the observation">
          {statements.map((statement,i)=><button type="button" aria-pressed={answer===i} key={statement} onClick={()=>setAnswer(i)}>{statement}</button>)}
        </div>
        {answer!==null && <p role="status">{answer===0
          ? 'Correct. The notes show that the topic recurs. The cause and preferred solution still need evidence.'
          : 'That statement still needs verification. Choose what is actually supported by the fictional notes.'}</p>}
      </div>
      <footer><strong>Your next move:</strong> Compare three possible needs in your own project. Ask what evidence would change your choice before selecting an AI solution.</footer>
    </section>
  )
}
