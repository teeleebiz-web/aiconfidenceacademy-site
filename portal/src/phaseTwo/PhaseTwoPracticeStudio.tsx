import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoPracticeStudio.css'

type PracticeDraft = {
  path: PhaseTwoProjectPath | ''
  title: string
  personServed: string
  recurringTask: string
  desiredResult: string
  capabilities: string[]
  evidence: string[]
  gaps: string[]
  humanPurpose: string
  aiSupport: string
  verification: string
  decisionOwner: string
  stopCondition: string
  correctedClaim: string
}
const blank = (): PracticeDraft => ({
  path: '', title: '', personServed: '', recurringTask: '', desiredResult: '',
  capabilities: Array(5).fill(''), evidence: Array(5).fill(''),
  gaps: Array(2).fill(''), humanPurpose: '', aiSupport: '',
  verification: '', decisionOwner: '', stopCondition: '', correctedClaim: '',
})

const steps = [
  { name: 'Choose your task', label: 'The work you want to improve' },
  { name: 'Show your capability', label: 'Five capabilities and two gaps' },
  { name: 'Assign responsibility', label: 'Define what AI and people each do' },
  { name: 'Check and keep', label: 'Practice the prompt, then save your evidence' },
] as const

function toProjectText(draft: PracticeDraft) {
  return [
    'PROFESSIONAL AI OPERATING MODEL — STARTING RECORD',
    'Project: ' + draft.title,
    'Path: ' + draft.path,
    'Person served: ' + draft.personServed,
    'Recurring task: ' + draft.recurringTask,
    'Desired result: ' + draft.desiredResult,
    'FIVE DEMONSTRABLE CAPABILITIES',
    ...draft.capabilities.map((item, i) => `${i + 1}. ${item} | Evidence: ${draft.evidence[i]}`),
    'TWO DEVELOPMENT GAPS',
    ...draft.gaps.map((gap, i) => `${i + 1}. ${gap}`),
    'HUMAN–AI RESPONSIBILITY MAP',
    'Human purpose: ' + draft.humanPurpose,
    'Permitted AI support: ' + draft.aiSupport,
    'Evidence to check: ' + draft.verification,
    'Final human decision owner: ' + draft.decisionOwner,
    'Stop or escalation condition: ' + draft.stopCondition,
    'A correction I made: ' + draft.correctedClaim,
  ].join('\n')
}

function sanitizeArray(values: unknown, length: number): string[] {
  const items = Array.isArray(values) ? values : []
  return Array.from({ length }, (_, i) => typeof items[i] === 'string' ? items[i] : '')
}

export function PhaseTwoPracticeStudio({
  approvedAiRequest,
  enrollmentId,
}: {
  approvedAiRequest: string
  enrollmentId?: string
}) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<PracticeDraft>(blank)
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [savedVersion, setSavedVersion] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!enrollmentId) return
    let active = true
    setStatus('loading')
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active) return
      const prior = record?.sections?.professional_ai_operating_model
      const saved = prior && typeof prior === 'object' ? prior as Record<string, unknown> : null
      if (record) {
        setDraft(old => ({
          ...old,
          path: record.project_path,
          title: record.project_title,
          ...(saved && {
            personServed: String(saved.personServed ?? ''),
            recurringTask: String(saved.recurringTask ?? ''),
            desiredResult: String(saved.desiredResult ?? ''),
            capabilities: sanitizeArray(saved.capabilities, 5),
            evidence: sanitizeArray(saved.evidence, 5),
            gaps: sanitizeArray(saved.gaps, 2),
            humanPurpose: String(saved.humanPurpose ?? ''),
            aiSupport: String(saved.aiSupport ?? ''),
            verification: String(saved.verification ?? ''),
            decisionOwner: String(saved.decisionOwner ?? ''),
            stopCondition: String(saved.stopCondition ?? ''),
            correctedClaim: String(saved.correctedClaim ?? ''),
          }),
        }))
        setSavedVersion(record.version_number)
      }
      setStatus('idle')
    }).catch(() => {
      if (active) { setStatus('error'); setMessage('Previous work could not load. Try again before saving.') }
    })
    return () => { active = false }
  }, [enrollmentId])

  const change = (field: keyof PracticeDraft, value: string) => {
    setDraft(current => ({ ...current, [field]: value }))
    setStatus('idle')
    setMessage('')
  }
  const changeList = (field: 'capabilities' | 'evidence' | 'gaps', index: number, value: string) => {
    setDraft(current => ({
      ...current, [field]: current[field].map((item,i) => i === index ? value : item),
    }))
    setStatus('idle'); setMessage('')
  }
  const preparedNotes = toProjectText(draft)
  const complete = !!draft.path && !!draft.title.trim() && !!draft.personServed.trim() &&
    !!draft.recurringTask.trim() && !!draft.desiredResult.trim() &&
    draft.capabilities.every(x => x.trim()) && draft.evidence.every(x => x.trim()) &&
    draft.gaps.every(x => x.trim()) &&
    !!draft.humanPurpose.trim() && !!draft.aiSupport.trim() &&
    !!draft.verification.trim() && !!draft.decisionOwner.trim() &&
    !!draft.stopCondition.trim() && !!draft.correctedClaim.trim()

  const copy = async (content: string, success: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(content)
      setCopied(true); setMessage(success)
    } catch {
      setMessage('Copy is unavailable in this browser. Select the visible text to copy it.')
    }
  }

  async function save() {
    if (!complete || !enrollmentId || status === 'saving' || status === 'loading') return
    setStatus('saving'); setMessage('')
    try {
      const { path, title, ...rest } = draft
      const result = await savePhaseTwoProjectUpdate({
        enrollmentId,
        path: path as PhaseTwoProjectPath,
        title,
        patch: { professional_ai_operating_model: { ...rest, text: preparedNotes } },
        decisionNote: 'Reviewed Lesson 1.1 capability inventory and human–AI responsibility map.',
      })
      setSavedVersion(result.saved_version)
      setStatus('saved'); setMessage('Saved to My Project Record. You can return and revise this work.')
    } catch {
      setStatus('error')
      setMessage('Your work was not saved. Keep this page open and try again.')
    }
  }

  return (
    <section className="p2-practice-studio" aria-labelledby="p2-practice-studio-title">
      <header className="p2-practice-studio-header">
        <div>
          <p className="p2-practice-kicker">Build with what you have learned</p>
          <h2 id="p2-practice-studio-title">Your first professional AI responsibility map</h2>
          <p>Use one real, manageable task. You will carry this same project into your next lessons.</p>
        </div>
        <span>Guided project</span>
      </header>
      <nav className="p2-practice-studio-steps" aria-label="Guided project steps">
        {steps.map((item,i) => <button key={item.name} type="button" onClick={()=>setStep(i)} aria-current={step===i ? 'step' : undefined}>
          <strong>{i+1}</strong><span>{item.name}</span>
        </button>)}
      </nav>

      <div className="p2-practice-studio-body">
        <p className="p2-practice-studio-step-label">Step {step+1} of 4</p>
        <h3>{steps[step].label}</h3>
        {step===0 && (
          <div className="p2-practice-fields">
            <label>Choose the type of project
              <select value={draft.path} onChange={e=>change('path',e.target.value)}>
                <option value="">Choose a path</option>
                <option value="A">Path A — Improve an existing process</option>
                <option value="B">Path B — Develop a new product or service</option>
              </select>
            </label>
            <label>Give your project a short name
              <input value={draft.title} onChange={e=>change('title',e.target.value)} placeholder="For example: clearer service updates" />
            </label>
            <label>Who benefits from this work?
              <textarea rows={2} value={draft.personServed} onChange={e=>change('personServed',e.target.value)} placeholder="A person or group with a real need" />
            </label>
            <label>What task happens repeatedly?
              <textarea rows={2} value={draft.recurringTask} onChange={e=>change('recurringTask',e.target.value)} placeholder="Describe the recurring activity" />
            </label>
            <label>What would a useful outcome look like?
              <textarea rows={2} value={draft.desiredResult} onChange={e=>change('desiredResult',e.target.value)} placeholder="Describe the result without promising what AI can do" />
            </label>
          </div>
        )}
        {step===1 && (
          <div className="p2-practice-fields">
            <p>Name five things you can actually demonstrate. For each, identify an example or evidence rather than simply saying you know how.</p>
            {draft.capabilities.map((claim,i)=>(
              <div className="p2-practice-capability" key={i}>
                <strong>Capability {i+1}</strong>
                <label>What can you demonstrate?
                  <textarea rows={2} value={claim} onChange={e=>changeList('capabilities',i,e.target.value)} placeholder="Name one specific ability"/>
                </label>
                <label>What supports that claim?
                  <textarea rows={2} value={draft.evidence[i]} onChange={e=>changeList('evidence',i,e.target.value)} placeholder="Sanitized work sample, verified decision or specific example"/>
                </label>
              </div>
            ))}
            <h4>Two gaps worth developing</h4>
            {draft.gaps.map((gap,i)=><label key={i}>Development gap {i+1}
              <textarea rows={2} value={gap} onChange={e=>changeList('gaps',i,e.target.value)} placeholder="What can't you demonstrate yet? What evidence would help?"/>
            </label>)}
          </div>
        )}
        {step===2 && (
          <div className="p2-practice-fields">
            <p>For the task you selected, assign the work deliberately. AI helps; the person retains responsibility for review and final action.</p>
            {([
              ['humanPurpose','What is the human purpose?','What result must the work achieve for the people involved?'],
              ['aiSupport','What work may AI assist with?','Drafting, organizing, comparing or finding questions within approved limits'],
              ['verification','What evidence must a person check?','Name the specific record, source or comparison'],
              ['decisionOwner','Who makes the final decision?','Name the responsible role, not the AI tool'],
              ['stopCondition','When must this work pause or be escalated?','Identify one missing source, permission or unacceptable risk'],
            ] as const).map(([key,label,hint])=>(
              <label key={key}>{label}
                <textarea rows={2} value={draft[key]} onChange={e=>change(key,e.target.value)} placeholder={hint}/>
              </label>
            ))}
          </div>
        )}
        {step===3 && (
          <div className="p2-practice-fields">
            <label>What misleading or unsupported claim did you catch and correct?
              <textarea rows={3} value={draft.correctedClaim} onChange={e=>change('correctedClaim',e.target.value)}
                placeholder="Explain the claim, the evidence, and what you changed or withheld"/>
            </label>
            <div className="p2-practice-chatgpt">
              <h4>Now practice with ChatGPT</h4>
              <p>Review your notes. Remove personal, confidential or unauthorized details before sharing anything with an AI tool.</p>
              <div className="p2-practice-prompt">
                <p>{approvedAiRequest.replace('[sanitized notes]', '[your sanitized project notes]')}</p>
              </div>
              <button type="button" onClick={()=>{void copy(approvedAiRequest.replace('[sanitized notes]',preparedNotes),'Prompt and your notes copied. Paste into ChatGPT and inspect its answer carefully.')}}>
                {copied?'Copy prompt again':'Copy prompt with my notes'}
              </button>
            </div>
            <div className="p2-practice-summary">
              <h4>What your Project Record will contain</h4>
              <pre>{preparedNotes}</pre>
            </div>
            <div className="p2-practice-save">
              <p>{complete ? 'Your starting record includes the required evidence and responsibility fields.' :
                'Finish your task, all five evidence-linked capabilities, two gaps and responsibility map before saving.'}</p>
              {enrollmentId ? (
                <button type="button" disabled={!complete || status==='saving'||status==='loading'} onClick={()=>{void save()}}>
                  {status==='saving'?'Saving…':savedVersion ? 'Save revised project record':'Save to My Project Record'}
                </button>
              ) : <button type="button" onClick={()=>{void copy(preparedNotes,'Project notes copied. Keep them with your continuing project.') }}>
                Copy my project notes
              </button>}
              {savedVersion !== null && <small>Last saved project version: {savedVersion}</small>}
            </div>
          </div>
        )}
      </div>
      <footer className="p2-practice-studio-footer">
        <button type="button" disabled={step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}>Previous step</button>
        <span role="status">{message}</span>
        <button type="button" disabled={step===3} onClick={()=>setStep(s=>Math.min(3,s+1))}>Next step <span aria-hidden="true">→</span></button>
      </footer>
    </section>
  )
}
