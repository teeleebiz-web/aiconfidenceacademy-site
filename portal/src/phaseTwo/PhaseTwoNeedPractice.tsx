import { useEffect, useMemo, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoNeedPractice.css'

type Need = { person: string; symptom: string; possibleCause: string; evidence: string; evidenceType: string; question: string }
const emptyNeed = (): Need => ({ person: '', symptom: '', possibleCause: '', evidence: '', evidenceType: 'unverified', question: '' })
const template = 'Help distinguish symptoms, possible causes and assumptions in these notes. Suggest five neutral questions to test the need. Do not present audience preferences as established facts. Notes:\n'
const starterQuestions = ['', '', '', '', '']

export function PhaseTwoNeedPractice({ enrollmentId }: { enrollmentId?: string }) {
  const [needs, setNeeds] = useState<Need[]>([emptyNeed(), emptyNeed(), emptyNeed()])
  const [selected, setSelected] = useState(0)
  const [situation, setSituation] = useState('')
  const [barrier, setBarrier] = useState('')
  const [desired, setDesired] = useState('')
  const [questions, setQuestions] = useState(starterQuestions)
  const [wouldChange, setWouldChange] = useState('')
  const [sourceToCheck, setSourceToCheck] = useState('')
  const [correction, setCorrection] = useState('')
  const [project, setProject] = useState<{path: PhaseTwoProjectPath; title: string} | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!enrollmentId) return
    let cancelled = false
    loadPhaseTwoProject(enrollmentId).then(result => {
      if (!cancelled && result) setProject({path: result.project_path, title: result.project_title})
    }).catch(() => { if (!cancelled) setStatus('Your existing project could not load. You can still copy your work.') })
    return () => { cancelled = true }
  }, [enrollmentId])
  const chosen = needs[selected]
  const complete = needs.every(n => n.person.trim() && n.symptom.trim() && n.possibleCause.trim() && n.question.trim()) &&
    questions.every(q => q.trim()) && situation.trim() && barrier.trim() && desired.trim() && wouldChange.trim() && sourceToCheck.trim()
  const record = useMemo(() => ({
    lesson: '1.2', exercise: 'Audience-Need View',
    needs, selected_index: selected, selected_need: {
      person: chosen.person, situation, need: chosen.symptom, barrier,
      desired_result: desired, possible_cause_hypothesis: chosen.possibleCause
    },
    neutral_questions: questions, evidence_to_request: sourceToCheck,
    evidence_that_would_change_choice: wouldChange, learner_ai_revision_note: correction,
    simulated_case_not_real_research: true
  }), [needs,selected,chosen,situation,barrier,desired,questions,sourceToCheck,wouldChange,correction])
  const summary = JSON.stringify(record,null,2)
  const aiNotes = needs.map((n,i) => [
    'Possible need '+(i+1), 'Person: '+n.person, 'Reported or observed symptom: '+n.symptom,
    'Possible cause (unverified hypothesis): '+n.possibleCause,
    'Evidence type: '+n.evidenceType, 'Evidence / source: '+n.evidence,
    'Unanswered question: '+n.question
  ].join('\n')).join('\n\n')
  const copy = async (value: string, message: string) => {
    try { await navigator.clipboard.writeText(value); setStatus(message) }
    catch { setStatus('Copy was unavailable. Select and copy the text shown in the lesson.') }
  }
  const updateNeed = (index:number, key:keyof Need, value:string) =>
    setNeeds(list => list.map((n,i) => i===index ? {...n,[key]:value} : n))
  const updateQuestion = (index:number,value:string) =>
    setQuestions(list => list.map((q,i) => i===index ? value : q))
  async function save() {
    if (!enrollmentId || !project || !complete) return
    setSaving(true);setStatus('')
    try {
      const result = await savePhaseTwoProjectUpdate({
        enrollmentId, path: project.path, title: project.title,
        patch: { professional_ai_operating_model: { audience_need_lesson_1_2: record } },
        decisionNote: 'Lesson 1.2 — audience need, alternatives, evidence and provisional decision'
      })
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'.')
    } catch {
      setStatus('The project could not be saved. Your answers remain on this page. Please try again or copy them.')
    } finally {setSaving(false)}
  }
  return (
    <section className="p2-need-practice" aria-labelledby="p2-need-practice-title">
      <header>
        <p className="eyebrow">Use AI • Inspect • Decide • Save</p>
        <h2 id="p2-need-practice-title">Investigate a real need with your AI assistant</h2>
        <p>Keep working on the project you began in Lesson 1.1. Work on your phone, tablet or computer, using a separate browser tab or app for the AI tool you choose. Return to the Academy with your reviewed results.</p>
      </header>
      <h3>1. Compare three possible needs</h3>
      <p>Use public, fictional or appropriately authorized information. An AI suggestion is not customer research. State unknowns instead of inventing evidence.</p>
      {needs.map((n,index) => <fieldset key={index}>
        <legend>Possible need {index+1}</legend>
        <label>Who is affected?<input value={n.person} onChange={e=>updateNeed(index,'person',e.target.value)} /></label>
        <label>What visible difficulty or reported symptom occurs?<textarea value={n.symptom} onChange={e=>updateNeed(index,'symptom',e.target.value)} /></label>
        <label>What is one possible cause (hypothesis, not fact)?<textarea value={n.possibleCause} onChange={e=>updateNeed(index,'possibleCause',e.target.value)} /></label>
        <label>Evidence category<select value={n.evidenceType} onChange={e=>updateNeed(index,'evidenceType',e.target.value)}>
          <option value="unverified">Not yet established</option><option value="observed">Observed in approved record</option>
          <option value="reported">Reported by authorized person</option><option value="assumed">Assumption</option>
          <option value="simulated">Fictional/simulated exercise</option>
        </select></label>
        <label>What evidence or source do you have?<textarea value={n.evidence} onChange={e=>updateNeed(index,'evidence',e.target.value)} /></label>
        <label>What remains unanswered?<textarea value={n.question} onChange={e=>updateNeed(index,'question',e.target.value)} /></label>
      </fieldset>)}
      <h3>2. Work with your chosen AI tool</h3>
      <p>Copy the request, open your own AI assistant, paste it there, and assess its suggestions. Do not upload confidential notes or present AI-generated examples as real interviews.</p>
      <textarea readOnly aria-label="Copyable AI investigation request" value={template+aiNotes} rows={8}/>
      <button type="button" onClick={()=>void copy(template+aiNotes,'AI investigation request copied. Paste it into your chosen assistant, then examine the result.')}>Copy AI investigation request</button>
      <h3>3. Review and improve the five neutral questions</h3>
      {questions.map((q,i)=><label key={i}>Neutral question {i+1}<textarea value={q} onChange={e=>updateQuestion(i,e.target.value)} placeholder="Ask what the person currently does, without suggesting your preferred tool"/></label>)}
      <label>What did you correct or reject from the AI output?<textarea value={correction} onChange={e=>setCorrection(e.target.value)}/></label>
      <h3>4. Select one provisional need</h3>
      <label>Which of the three needs will you investigate first?<select value={selected} onChange={e=>setSelected(Number(e.target.value))}>
        {needs.map((_,i)=><option key={i} value={i}>Possible need {i+1}</option>)}
      </select></label>
      <label>Situation<textarea value={situation} onChange={e=>setSituation(e.target.value)}/></label>
      <label>Barrier needing investigation<textarea value={barrier} onChange={e=>setBarrier(e.target.value)}/></label>
      <label>Desired result, without naming an AI product<textarea value={desired} onChange={e=>setDesired(e.target.value)}/></label>
      <label>What authorized source or conversation will you check?<textarea value={sourceToCheck} onChange={e=>setSourceToCheck(e.target.value)}/></label>
      <label>What evidence would change your selection?<textarea value={wouldChange} onChange={e=>setWouldChange(e.target.value)}/></label>
      <div className="p2-need-practice-save">
        {enrollmentId && project
          ? <button disabled={!complete||saving} type="button" onClick={()=>void save()}>{saving?'Saving…':'Save to My Project Record'}</button>
          : <p>Founder preview or no active project record: copy the completed work rather than displaying a false save confirmation.</p>}
        <button type="button" onClick={()=>void copy(summary,'Lesson 1.2 project notes copied.')}>Copy my Lesson 1.2 record</button>
        <p role="status">{status || (complete?'Your record is ready for review.':'Complete the comparison, five questions and provisional decision before saving.')}</p>
      </div>
    </section>
  )
}
