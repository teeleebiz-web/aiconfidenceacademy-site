import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  original: 'Communication from Lesson 2.2 to review',
  audience: 'Recipient, purpose and intended next action',
  correct: 'Correct — facts, names, dates, numbers and instructions',
  listener: 'Listener — does it serve this audience?',
  enough: 'Enough — missing detail and unnecessary repetition',
  appropriate: 'Appropriate — tone and setting',
  responsible: 'Responsible — privacy, fairness, risk, authority and accountability',
  critique: 'AI critique (additional input, not verification)',
  comparison: 'What did you accept, revise or reject, and why?',
  claim: 'Exact material claim you checked',
  source: 'Authoritative source or approved record and relevant detail',
  sourceDate: 'Source date or version (state unknown if unavailable)',
  checkedDate: 'Actual date you checked the source',
  result: 'Verification result — supported, contradicted or unresolved, and why',
  revised: 'Revised communication',
  changes: 'What changed and why the result is more useful',
  approval: 'Authorized human approver and actual approval status (or pending)',
  limits: 'Remaining limits and unresolved claims (or explain none remain)',
  appliedCheck: 'Correct the fictional draft: invented fact, audience tone and missing next action',
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft
const groups: Array<{heading:string;keys:Array<keyof Draft>}> = [
  {heading:'1. Review personally with CLEAR',keys:['original','audience','correct','listener','enough','appropriate','responsible']},
  {heading:'2. Compare your review with AI critique',keys:['critique','comparison']},
  {heading:'3. Verify one important claim',keys:['claim','source','sourceDate','checkedDate','result']},
  {heading:'4. Revise and retain human approval',keys:['revised','changes','approval','limits','appliedCheck']},
]
export function PhaseTwoClearPractice({enrollmentId,approvedAiRequest}:{enrollmentId?:string;approvedAiRequest:string}) {
  const [draft,setDraft]=useState<Draft>(blank)
  const [project,setProject]=useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
  const [status,setStatus]=useState('')
  const [saving,setSaving]=useState(false)
  useEffect(()=>{
    if(!enrollmentId)return
    let active=true
    void loadPhaseTwoProject(enrollmentId).then(record=>{
      if(!active||!record)return
      setProject({path:record.project_path,title:record.project_title})
      const section=record.sections.prompt_and_communication_evidence as {
        clear_lesson_2_3?:{draft?:Partial<Draft>};
        communication_lesson_2_2?:{draft?:{revised?:string;audience?:string;purpose?:string;response?:string}}
      }|undefined
      const prior=section?.clear_lesson_2_3?.draft
      if(prior)setDraft(Object.fromEntries(Object.keys(fields).map(key=>[key,typeof prior[key as keyof Draft]==='string'?prior[key as keyof Draft]:''])) as Draft)
      else {
        const before=section?.communication_lesson_2_2?.draft
        if(before)setDraft(old=>({...old,original:before.revised??'',audience:[before.audience,before.purpose,before.response].filter(Boolean).join('\n')}))
      }
    }).catch(()=>{if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
    return()=>{active=false}
  },[enrollmentId])
  const request=approvedAiRequest.replace('[inputs]',draft.original||'[inputs]')+
    '\n\nAudience, purpose and next action: '+draft.audience+
    '\nAuthorized source extract only (omit private material): '+draft.source
  const complete=Object.values(draft).every(text=>text.trim().length>0)
  const evidence={lesson:'2.3',draft,critique_request:request,practice_only_not_permission_to_send:true}
  const recordText=JSON.stringify(evidence,null,2)
  async function copy(text:string,message:string){
    try{await navigator.clipboard.writeText(text);setStatus(message)}
    catch{setStatus('Clipboard is unavailable. Select the request or record text below to copy it.')}
  }
  async function save(){
    if(!enrollmentId||!project||!complete||saving)return
    setSaving(true)
    try{
      const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,
        patch:{prompt_and_communication_evidence:{clear_lesson_2_3:evidence}},
        decisionNote:'Lesson 2.3 — CLEAR findings, source verification, revision and human approval status'})
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'.')
    }catch{setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally{setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-clear-heading">
    <header><p className="eyebrow">Continue Your Project · Review · Verify · Revise</p>
      <h2 id="p2-clear-heading">Review your communication with CLEAR</h2>
      <p>Use your saved Lesson 2.2 communication and your own AI assistant. Review personally first. Share only fictional or authorized material. AI critique does not verify facts or grant approval.</p>
    </header>
    {groups.map((group,i)=><div key={group.heading}>
      <h3>{group.heading}</h3>
      {i===0&&<p>Record a finding and reason under every category, including where no change is needed.</p>}
      {i===2&&<p>Check an exact claim against a source with authority over it. Keep private records private. Record the real check date.</p>}
      {i===3&&<p>FICTIONAL APPLIED CHECK: “Your estimate is approved; delivery is guaranteed in five days. Supply the outstanding specifications immediately.” The fictional record confirms only review within two business days after complete inputs arrive. Room dimensions and a preferred appointment date are missing. Scheduling owner approval is required for appointments. Correct all three problems and name the approval route.</p>}
      {group.keys.map(key=><label key={key}>{fields[key]}<textarea rows={key==='original'||key==='revised'?5:3} value={draft[key]} onChange={e=>setDraft(old=>({...old,[key]:e.target.value}))}/></label>)}
      {i===1&&<><label>CLEAR critique request<textarea readOnly rows={7} value={request}/></label>
        <button type="button" onClick={()=>void copy(request,'CLEAR request copied. Use it with your chosen AI assistant.')}>Copy CLEAR critique request</button></>}
    </div>)}
    <p>Obtain approval from the authorized person before real use. If approval is pending, save a reviewed draft awaiting approval. Fictional practice describes the approval route and does not count as real approval.</p>
    <div className="p2-workflow-practice-save">
      {enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save CLEAR evidence to My Project Record'}</button>
        :<p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={()=>void copy(recordText,'Lesson 2.3 CLEAR evidence copied.')}>Copy my Lesson 2.3 record</button>
      <details><summary>Read or copy my CLEAR record</summary><textarea aria-label="Lesson 2.3 CLEAR record" readOnly rows={12} value={recordText}/></details>
      <p role="status">{status||(complete?'Your evidence is ready to save for review.':'Complete the five CLEAR findings, source check, revision and approval status before saving.')}</p>
    </div>
  </section>
}
