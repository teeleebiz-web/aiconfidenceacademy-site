import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  purpose: 'What workflow need should this message serve?',
  audience: 'Who receives it, and what do they already know?',
  channel: 'What format or channel will you use?',
  response: 'What should the recipient do next?',
  facts: 'Approved facts and their sources (label fictional practice)',
  voice: 'A short authorized sample of your intended voice',
  constraints: 'Limits, human approval and quality requirements',
  original: 'Original communication or first AI draft',
  improvedRequest: 'Your improved request and reason for the revision',
  revised: 'Revised communication',
  secondAudience: 'Second audience or channel and why it needs an adaptation',
  adapted: 'Adapted communication',
  unchanged: 'One factual meaning preserved in both versions and its source',
  changes: 'One wording change that helps the recipient act',
  claims: 'Claims still needing verification (or explain that none remain)',
  approval: 'Who can approve this message before it is sent?',
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft
const groups: Array<{heading:string;keys:Array<keyof Draft>}> = [
  {heading:'1. Choose the useful communication', keys:['purpose','audience','channel','response']},
  {heading:'2. Direct and improve the draft', keys:['facts','voice','constraints','original','improvedRequest','revised']},
  {heading:'3. Adapt it without changing the facts', keys:['secondAudience','adapted','unchanged']},
  {heading:'4. Check the reader experience and keep the evidence', keys:['changes','claims','approval']},
]

export function PhaseTwoCommunicationPractice({enrollmentId, approvedAiRequest}: {enrollmentId?:string;approvedAiRequest:string}) {
  const [draft,setDraft] = useState<Draft>(blank)
  const [project,setProject] = useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
  const [status,setStatus] = useState('')
  const [saving,setSaving] = useState(false)
  useEffect(() => {
    if (!enrollmentId) return
    let active=true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active || !record) return
      setProject({path:record.project_path,title:record.project_title})
      const section=record.sections.prompt_and_communication_evidence as {communication_lesson_2_2?:{draft?:Partial<Draft>}}|undefined
      const prior=section?.communication_lesson_2_2?.draft
      if (prior) setDraft(Object.fromEntries(Object.keys(fields).map(key => [key,typeof prior[key as keyof Draft]==='string'?prior[key as keyof Draft]:''])) as Draft)
    }).catch(() => {if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
    return () => {active=false}
  },[enrollmentId])
  const request=approvedAiRequest.replace('[format]',draft.channel||'[format]').replace('[audience]',draft.audience||'[audience]')
    .replace('[response]',draft.response||'[response]').replace('[brief]',draft.constraints||'[brief]')+
    '\n\nPurpose and context: '+draft.purpose+'\nApproved facts and sources: '+draft.facts+'\nVoice sample: '+draft.voice
  const complete=Object.values(draft).every(text => text.trim().length>0)
  const evidence={lesson:'2.2',draft,initial_request:request,practice_only_not_permission_to_send:true}
  const recordText=JSON.stringify(evidence,null,2)
  async function copy(text:string,message:string) {
    try {await navigator.clipboard.writeText(text);setStatus(message)}
    catch {setStatus('Clipboard is unavailable. Select the request or record text below to copy it.')}
  }
  async function save() {
    if (!enrollmentId || !project || !complete || saving) return
    setSaving(true)
    try {
      const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,
        patch:{prompt_and_communication_evidence:{communication_lesson_2_2:evidence}},
        decisionNote:'Lesson 2.2 — original, revised and adapted communication with sources and approval owner'})
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'.')
    } catch {setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally {setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-communication-heading">
    <header><p className="eyebrow">Continue Your Project · Draft · Adapt · Verify</p>
      <h2 id="p2-communication-heading">Produce a message your audience can use</h2>
      <p>Use your Lesson 2.1 workflow and your own AI assistant. Share only fictional or authorized facts. Keep your first draft, improve it, and prepare a second version for a clear audience or channel need.</p>
    </header>
    {groups.map((group,i) => <div key={group.heading}>
      <h3>{group.heading}</h3>
      {i===1 && <p>Use purpose, audience, context, task, constraints and quality. Ask your assistant about missing facts; keep commitments within the approved source.</p>}
      {group.keys.map(key => <label key={key}>{fields[key]}<textarea rows={key==='original'||key==='revised'||key==='adapted'?5:3}
        value={draft[key]} onChange={e=>setDraft(old=>({...old,[key]:e.target.value}))}/></label>)}
      {i===1 && <><label>Communication AI request<textarea readOnly rows={7} value={request}/></label>
        <button type="button" onClick={()=>void copy(request,'Communication request copied. Use it with your chosen AI assistant.')}>Copy communication request</button></>}
    </div>)}
    <p>Read both versions against the source. Check conditions, timing, status and responsibilities. Keep unresolved claims visible for the full CLEAR review in Lesson 2.3.</p>
    <div className="p2-workflow-practice-save">
      {enrollmentId&&project ? <button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save communication evidence to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={()=>void copy(recordText,'Lesson 2.2 communication evidence copied.')}>Copy my Lesson 2.2 record</button>
      <details><summary>Read or copy my communication record</summary><textarea aria-label="Lesson 2.2 communication record" readOnly rows={12} value={recordText}/></details>
      <p role="status">{status||(complete?'Your evidence is ready to save for review.':'Complete the original, revised and adapted messages and their checks before saving.')}</p>
    </div>
  </section>
}
