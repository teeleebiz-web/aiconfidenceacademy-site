import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoNeedPractice.css'

type EvidenceType = 'observed' | 'reported' | 'assumed' | 'simulated' | 'not_established'
type Need = {
  person: string
  symptom: string
  possibleCause: string
  evidenceType: EvidenceType
  evidenceSource: string
  unansweredQuestion: string
}
type NeedDraft = {
  candidates: Need[]
  chosen: number | null
  situation: string
  needWithoutTool: string
  barrier: string
  desiredResult: string
  neutralQuestions: string[]
  disconfirmingEvidence: string
  verificationPlan: string
  aiTool: string
  aiReview: string
  sanitizedNotes: string
}

const emptyNeed = (): Need => ({
  person: '', symptom: '', possibleCause: '', evidenceType: 'not_established',
  evidenceSource: '', unansweredQuestion: '',
})
const emptyDraft = (): NeedDraft => ({
  candidates: [emptyNeed(), emptyNeed(), emptyNeed()],
  chosen: null, situation: '', needWithoutTool: '', barrier: '',
  desiredResult: '', neutralQuestions: Array(5).fill(''),
  disconfirmingEvidence: '', verificationPlan: '', aiTool: '',
  aiReview: '', sanitizedNotes: '',
})
const stages = ['Compare three needs', 'Investigate with AI', 'Make a provisional choice', 'Verify and save'] as const
const evidenceTypes: Array<{ value: EvidenceType; label: string }> = [
  { value: 'observed', label: 'Observed in an authorized source' },
  { value: 'reported', label: 'Reported by a person (not independently proven)' },
  { value: 'assumed', label: 'Assumption / possible explanation' },
  { value: 'simulated', label: 'Fictional practice data only' },
  { value: 'not_established', label: 'No evidence established yet' },
]
const validEvidence = new Set(evidenceTypes.map(item => item.value))
export function restoreNeedDraft(value: unknown): NeedDraft {
  const result = emptyDraft()
  if (!value || typeof value !== 'object') return result
  const saved = value as Partial<NeedDraft>
  if (Array.isArray(saved.candidates)) {
    result.candidates = Array.from({length:3}, (_, i) => {
      const candidate = saved.candidates?.[i] ?? emptyNeed()
      return {
        person: typeof candidate.person === 'string' ? candidate.person : '',
        symptom: typeof candidate.symptom === 'string' ? candidate.symptom : '',
        possibleCause: typeof candidate.possibleCause === 'string' ? candidate.possibleCause : '',
        evidenceType: validEvidence.has(candidate.evidenceType) ? candidate.evidenceType : 'not_established',
        evidenceSource: typeof candidate.evidenceSource === 'string' ? candidate.evidenceSource : '',
        unansweredQuestion: typeof candidate.unansweredQuestion === 'string' ? candidate.unansweredQuestion : '',
      }
    })
  }
  result.chosen = typeof saved.chosen === 'number' && Number.isInteger(saved.chosen) &&
    saved.chosen >= 0 && saved.chosen < 3 ? saved.chosen : null
  for (const field of ['situation','needWithoutTool','barrier','desiredResult','disconfirmingEvidence',
    'verificationPlan','aiTool','aiReview','sanitizedNotes'] as const) {
    if (typeof saved[field] === 'string') result[field] = saved[field]
  }
  if (Array.isArray(saved.neutralQuestions)) {
    result.neutralQuestions = Array.from({length:5}, (_,i) =>
      typeof saved.neutralQuestions?.[i] === 'string' ? saved.neutralQuestions[i] : '')
  }
  return result
}

export function needRecordText(draft: NeedDraft, projectTitle: string): string {
  return [
    'LESSON 1.2 — FIND THE NEED AND ESTABLISH THE EVIDENCE',
    'Continuing project: ' + (projectTitle || '[continue Lesson 1.1 project]'),
    'THREE POSSIBLE NEEDS',
    ...draft.candidates.flatMap((item,i) => [
      'Candidate '+(i+1)+': Person: '+item.person,
      'Reported / observed symptom: '+item.symptom,
      'Possible cause (not proven): '+item.possibleCause,
      'Evidence label: '+item.evidenceType,
      'Source or evidence gap: '+item.evidenceSource,
      'Unanswered question: '+item.unansweredQuestion,
    ]),
    'PROVISIONAL SELECTION: '+(draft.chosen===null ? 'Not yet selected' : 'Candidate '+(draft.chosen+1)),
    'Situation: '+draft.situation,
    'Need (no technology prescribed): '+draft.needWithoutTool,
    'Barrier (confirmed or hypothetical): '+draft.barrier,
    'Desired result: '+draft.desiredResult,
    'FIVE NEUTRAL QUESTIONS',
    ...draft.neutralQuestions.map((question,i)=>(i+1)+'. '+question),
    'Evidence that would change the decision: '+draft.disconfirmingEvidence,
    'Next authorized source check: '+draft.verificationPlan,
    'AI assistant used: '+draft.aiTool,
    'AI result checked and corrected: '+draft.aiReview,
  ].join('\n')
}

/**
 * Lesson 1.2 edits the existing Lesson 1.1 project.
 * No new workbook, assessment claim, course publishing or fallback fake save.
 */
export function PhaseTwoNeedPractice({ enrollmentId }: { enrollmentId?: string }) {
  const [stage, setStage] = useState(0)
  const [draft, setDraft] = useState<NeedDraft>(emptyDraft)
  const [path, setPath] = useState<PhaseTwoProjectPath | null>(null)
  const [projectTitle, setProjectTitle] = useState('')
  const [loading, setLoading] = useState(Boolean(enrollmentId))
  const [loadFailed, setLoadFailed] = useState(false)
  const [state, setState] = useState<'editing' | 'saving' | 'saved' | 'error'>('editing')
  const [message, setMessage] = useState('')
  const [notesSafe, setNotesSafe] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy AI request')

  useEffect(() => {
    if (!enrollmentId) return
    let live = true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!live) return
      if (record) {
        setPath(record.project_path)
        setProjectTitle(record.project_title)
        const section = record.sections?.professional_ai_operating_model
        const previous = section && typeof section === 'object'
          ? (section as Record<string,unknown>).need_validation_l12 : null
        setDraft(restoreNeedDraft(previous))
      }
      setLoading(false)
    }).catch(() => {
      if (live) { setLoading(false); setLoadFailed(true) }
    })
    return () => { live=false }
  }, [enrollmentId])

  function edit<K extends keyof NeedDraft>(field:K,value:NeedDraft[K]) {
    setDraft(previous => ({...previous,[field]:value}))
    setState('editing');setMessage('')
  }
  function editCandidate(index:number, field:keyof Need, value:string) {
    setDraft(previous => ({...previous,candidates:previous.candidates.map((item,i)=>
      i===index ? {...item,[field]:value} : item)}))
    setState('editing');setMessage('')
  }
  function editQuestion(index:number,value:string) {
    setDraft(previous=>({...previous,neutralQuestions:previous.neutralQuestions.map((item,i)=>i===index?value:item)}))
    setState('editing');setMessage('')
  }
  const copyText = async (text: string, successMessage: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setMessage(successMessage)
      setCopyLabel('Copied')
    } catch {
      setMessage('Clipboard access is unavailable. Select the visible text to copy it manually.')
    }
  }
  const aiRequest = 'Help distinguish symptoms, possible causes and assumptions in these notes. ' +
    'Suggest five neutral questions to test the need. Do not present audience preferences as established facts. ' +
    'Do not invent interviews, counts, customer demand, or a solution recommendation.\n\nNotes: ' +
    (draft.sanitizedNotes.trim() || '[sanitized project notes]')
  const complete = draft.candidates.every(item=>
    item.person.trim() && item.symptom.trim() && item.possibleCause.trim() && item.unansweredQuestion.trim()) &&
    draft.chosen !== null && draft.situation.trim() && draft.needWithoutTool.trim() &&
    draft.barrier.trim() && draft.desiredResult.trim() &&
    draft.neutralQuestions.every(item=>item.trim()) && draft.disconfirmingEvidence.trim() &&
    draft.verificationPlan.trim() && draft.aiReview.trim()
  async function save() {
    if (!enrollmentId || !path || !projectTitle.trim() || loading || loadFailed || state==='saving') return
    setState('saving');setMessage('')
    try {
      // Server-side recursive merge preserves the earlier 1.1 capability and responsibility fields.
      const response = await savePhaseTwoProjectUpdate({
        enrollmentId, path, title:projectTitle,
        patch: { professional_ai_operating_model: {need_validation_l12:draft} },
        decisionNote: 'Lesson 1.2 provisional need, source labels, neutral questions and disconfirmation condition saved.',
      })
      setState('saved')
      setMessage('Saved version '+response.saved_version+' to the SAME Project Record. You can revise this work later.')
    } catch {
      setState('error')
      setMessage('The project was not saved. Your entries are still on this page; retry after checking access.')
    }
  }

  return (
    <section className="p2-need-practice" aria-labelledby="p2-need-practice-title">
      <header className="p2-need-practice-header">
        <p className="eyebrow">Lesson 1.2 · Practical application</p>
        <h2 id="p2-need-practice-title">Investigate a need in your continuing project</h2>
        <p>Work with three possible needs, ask your own AI assistant to help compare them, and keep an evidence-labeled decision. The same project continues from Lesson 1.1.</p>
        <p className="p2-need-practice-project">
          {loading ? 'Loading your existing project…' :
            projectTitle ? 'Continuing: '+projectTitle+(path ? ' · Path '+path : '') :
            enrollmentId ? 'No saved Lesson 1.1 project was found. Return to Lesson 1.1 to establish your project.' :
            'Founder preview: work locally and copy your draft. No learner record is saved.'}
        </p>
      </header>
      {loadFailed && <p role="alert">We could not load your earlier project. Saving is blocked until it can be loaded safely. Copy your work before leaving this page.</p>}
      <nav className="p2-need-practice-steps" aria-label="Lesson 1.2 project steps">
        {stages.map((name,i)=><button key={name} type="button" aria-current={stage===i?'step':undefined}
          onClick={()=>{setStage(i);setCopyLabel('Copy AI request')}}><span>{i+1}</span>{name}</button>)}
      </nav>
      {stage===0 && <div className="p2-need-practice-body">
        <h3>Three needs worth investigating</h3>
        <p>Use the same business or offer you selected in Lesson 1.1. A reported symptom does not prove a cause. Label uncertainty without inventing evidence.</p>
        {draft.candidates.map((item,i)=><fieldset className="p2-need-candidate" key={i}>
          <legend>Possible need {i+1}</legend>
          <label>Who is affected?<input value={item.person} onChange={e=>editCandidate(i,'person',e.target.value)}
            placeholder="Person or group served" /></label>
          <label>What symptom was observed or reported?<textarea rows={2} value={item.symptom}
            onChange={e=>editCandidate(i,'symptom',e.target.value)} placeholder="What is happening? Do not invent frequency." /></label>
          <label>What could be causing it? (Hypothesis)<textarea rows={2} value={item.possibleCause}
            onChange={e=>editCandidate(i,'possibleCause',e.target.value)} placeholder="One possible explanation, not a proven fact" /></label>
          <label>Evidence category<select value={item.evidenceType}
            onChange={e=>editCandidate(i,'evidenceType',e.target.value)}>
            {evidenceTypes.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select></label>
          <label>Source or missing evidence<textarea rows={2} value={item.evidenceSource}
            onChange={e=>editCandidate(i,'evidenceSource',e.target.value)}
            placeholder="Authorized source, or 'Not yet established'" /></label>
          <label>What still needs to be checked?<textarea rows={2} value={item.unansweredQuestion}
            onChange={e=>editCandidate(i,'unansweredQuestion',e.target.value)}
            placeholder="Question that could change the hypothesis" /></label>
        </fieldset>)}
      </div>}
      {stage===1 && <div className="p2-need-practice-body">
        <h3>Use your chosen AI assistant on any device</h3>
        <p>Open ChatGPT or another AI tool you choose in a browser tab or app on your phone, tablet or computer. You bring the notes; the AI suggests possibilities, not facts.</p>
        <label>AI assistant used (optional)<input value={draft.aiTool}
          onChange={e=>edit('aiTool',e.target.value)} placeholder="Your own AI assistant" /></label>
        <label>Only sanitized notes to share<textarea rows={5} value={draft.sanitizedNotes}
          onChange={e=>{edit('sanitizedNotes',e.target.value);setNotesSafe(false)}}
          placeholder="Remove names, private customer details, unreleased business data and confidential information." /></label>
        <label className="p2-need-practice-checkbox"><input type="checkbox" checked={notesSafe}
          onChange={e=>setNotesSafe(e.target.checked)} /> I have removed private, confidential and unauthorized details.</label>
        <label>AI request (selectable text)<textarea readOnly rows={6} value={aiRequest} /></label>
        <button type="button" disabled={!notesSafe || !draft.sanitizedNotes.trim()}
          onClick={()=>void copyText(aiRequest,'AI request copied. Paste it into your chosen AI tool, then check the result.')}>{copyLabel}</button>
        <label>What did AI suggest, and what did you check or correct?<textarea rows={4} value={draft.aiReview}
          onChange={e=>edit('aiReview',e.target.value)}
          placeholder="Identify a useful comparison, a leading question or an unsupported claim that you corrected." /></label>
        <p>AI-created interview answers are not evidence of real customer experience. Verify against an authorized source before treating a claim as established.</p>
      </div>}
      {stage===2 && <div className="p2-need-practice-body">
        <h3>Make one provisional decision</h3>
        <p>Choose a candidate only for the next investigation—not as proof that a solution is needed.</p>
        <fieldset className="p2-need-choice"><legend>Your current choice</legend>
          {draft.candidates.map((item,i)=><label key={i}><input type="radio" name="p2-l12-choice"
            checked={draft.chosen===i} onChange={()=>edit('chosen',i)} />
            Candidate {i+1}: {item.person.trim() || 'Person not yet named'}</label>)}
        </fieldset>
        {([
          ['situation','Situation in which the need appears'],
          ['needWithoutTool','What is needed (do not name a technology)'],
          ['barrier','Possible barrier (label hypotheses clearly)'],
          ['desiredResult','What a successful result enables'],
          ['disconfirmingEvidence','What evidence would change your mind?'],
          ['verificationPlan','Next authorized source or interview to check'],
        ] as const).map(([field,label])=><label key={field}>{label}<textarea rows={2}
          value={draft[field]} onChange={e=>edit(field,e.target.value)} /></label>)}
        <h4>Five neutral questions</h4>
        <p>Do not ask people to endorse an AI product before you know what problem they experience.</p>
        {draft.neutralQuestions.map((question,i)=><label key={i}>Question {i+1}
          <textarea rows={2} value={question} onChange={e=>editQuestion(i,e.target.value)}
            placeholder={i===0?'What happens when the difficulty occurs?':'Describe current work without suggesting a solution.'} />
        </label>)}
      </div>}
      {stage===3 && <div className="p2-need-practice-body">
        <h3>Check the decision before saving</h3>
        <p>Keep each claim traceable. Your selected need is provisional; AI-generated possibilities remain possibilities.</p>
        <div className="p2-need-review-status" role="status">{complete
          ? 'All practice fields are filled. This is not automatic completion credit.'
          : 'Your draft is incomplete. You may still save a version to continue later.'}</div>
        <label>Copyable project record<textarea readOnly rows={16} value={needRecordText(draft,projectTitle)} /></label>
        <button type="button" onClick={()=>void copyText(needRecordText(draft,projectTitle),
          'Your Lesson 1.2 notes were copied. This does not save them to the Academy.')}>Copy my project notes</button>
        {enrollmentId && path && projectTitle && !loadFailed ? <button type="button"
          disabled={loading || state==='saving'} onClick={()=>void save()}>
          {state==='saving'?'Saving to My Project Record…':'Save in My Project Record'}</button> :
          <p className="p2-need-preview-note">No verified active Project Record is connected to this preview. Copy the notes above to retain them; no save has occurred.</p>}
        {message && <p role="status">{message}</p>}
        <p>Saving a working draft does not complete the lesson or award a credential. A human reviews evidence and decisions.</p>
      </div>}
      <div className="p2-need-practice-controls">
        <button type="button" disabled={stage===0} onClick={()=>setStage(i=>Math.max(0,i-1))}>Previous step</button>
        <button type="button" disabled={stage===stages.length-1}
          onClick={()=>setStage(i=>Math.min(stages.length-1,i+1))}>Next step →</button>
      </div>
      {message && stage!==3 && <p role="status">{message}</p>}
    </section>
  )
}
