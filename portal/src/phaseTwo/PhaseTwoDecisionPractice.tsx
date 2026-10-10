import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoDecisionPractice.css'

const request = 'Compare options A and B using this purpose, audience, context, constraints and quality standard. Separate supplied evidence, assumptions and unknowns. Ask necessary questions before recommending. Inputs: '
type Detail = {purpose:string; audience:string; context:string; task:string; constraints:string; quality:string}
const blank:Detail = {purpose:'',audience:'',context:'',task:'',constraints:'',quality:''}
const fields:[keyof Detail,string][] = [
  ['purpose','Purpose — why does this work matter?'],
  ['audience','Audience — who needs the outcome?'],
  ['context','Context — what verified information and previous project findings apply?'],
  ['task','Task — exactly what should the AI assistant produce?'],
  ['constraints','Constraints — what is off limits or requires approval?'],
  ['quality','Quality — how will a person judge the answer?'],
]
export function PhaseTwoDecisionPractice({enrollmentId}:{enrollmentId?:string}) {
  const [original,setOriginal] = useState('')
  const [detail,setDetail] = useState<Detail>(blank)
  const [optionA,setOptionA] = useState('')
  const [optionB,setOptionB] = useState('')
  const [comparison,setComparison] = useState('')
  const [unverified,setUnverified] = useState('')
  const [source,setSource] = useState('')
  const [followUp,setFollowUp] = useState('')
  const [changed,setChanged] = useState('')
  const [memo,setMemo] = useState('')
  const [owner,setOwner] = useState('')
  const [project,setProject] = useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
  const [message,setMessage] = useState('')
  const [saving,setSaving] = useState(false)
  useEffect(()=>{
    if(!enrollmentId)return
    let alive=true
    void loadPhaseTwoProject(enrollmentId).then(r=>{
      if(alive&&r)setProject({path:r.project_path,title:r.project_title})
    }).catch(()=>{if(alive)setMessage('Project Record could not load; copy your work to keep a backup.')})
    return ()=>{alive=false}
  },[enrollmentId])
  const improved=`${request}\nPurpose: ${detail.purpose}\nAudience: ${detail.audience}\nContext: ${detail.context}\nTask: ${detail.task}\nConstraints: ${detail.constraints}\nQuality standard: ${detail.quality}\nOption A: ${optionA}\nOption B: ${optionB}\nDo not invent interviews, delivery capacity, costs, or customer demand.`
  const complete=Boolean(original.trim()&&Object.values(detail).every(x=>x.trim())&&optionA.trim()&&optionB.trim()&&comparison.trim()&&unverified.trim()&&source.trim()&&followUp.trim()&&changed.trim()&&memo.trim()&&owner.trim())
  const record={lesson:'1.4',original_request:original,request_framework:detail,improved_request:improved,
    alternatives:{option_a:optionA,option_b:optionB,reviewed_comparison:comparison},
    challenged_claim:unverified,verification_source:source,substantive_follow_up:followUp,
    how_follow_up_changed_decision:changed,human_decision_memo:memo,decision_owner:owner,
    media_case_fictional_not_real_customer_research:true}
  const copy=async(t:string,success:string)=>{
    try{await navigator.clipboard.writeText(t);setMessage(success)}
    catch{setMessage('Clipboard unavailable. Select the text shown in the request or copy your notes manually.')}
  }
  async function save(){
    if(!enrollmentId||!project||!complete)return
    setSaving(true);setMessage('')
    try{
      const result=await savePhaseTwoProjectUpdate({
        enrollmentId,path:project.path,title:project.title,
        patch:{professional_ai_operating_model:{professional_request_lesson_1_4:record}},
        decisionNote:'Lesson 1.4 — original and improved requests, evidence challenge, follow-up and decision memo'
      })
      setMessage('Saved to the continuing Project Record. Version '+result.saved_version+'.')
    }catch{setMessage('Your work was not saved. Keep this page open, retry or copy a backup.')}
    finally{setSaving(false)}
  }
  return <section className="p2-decision-practice" aria-labelledby="p2-decision-heading">
    <header><p className="eyebrow">Use AI • Clarify • Compare • Decide</p>
      <h2 id="p2-decision-heading">Build a professional request and decision memo</h2>
      <p>Continue the same project from Lessons 1.1–1.3. Use your own AI assistant on a phone, tablet, or computer. Only supply fictional or authorized sanitized material.</p>
    </header>
    <h3>1. Preserve your original request</h3>
    <label>What would you have asked AI initially?<textarea value={original} onChange={e=>setOriginal(e.target.value)} /></label>
    <h3>2. Improve the request with all six elements</h3>
    {fields.map(([key,label])=><label key={key}>{label}
      <textarea value={detail[key]} onChange={e=>setDetail(d=>({...d,[key]:e.target.value}))}/>
    </label>)}
    <h3>3. Compare two possible approaches</h3>
    <label>Option A<textarea value={optionA} onChange={e=>setOptionA(e.target.value)}/></label>
    <label>Option B<textarea value={optionB} onChange={e=>setOptionB(e.target.value)}/></label>
    <p>Copy this improved request, open your own AI tool and ask it to compare the two approaches. Bring the result back for human review.</p>
    <textarea aria-label="Professional AI request to copy" readOnly rows={11} value={improved}/>
    <button type="button" onClick={()=>void copy(improved,'Professional AI request copied. Paste into your selected AI tool.')}>Copy improved AI request</button>
    <label>What did the AI-assisted comparison actually show, including tradeoffs and uncertainty?<textarea value={comparison} onChange={e=>setComparison(e.target.value)}/></label>
    <h3>4. Challenge a material claim and follow up</h3>
    <label>Which important claim or assumption was unsupported?<textarea value={unverified} onChange={e=>setUnverified(e.target.value)}/></label>
    <label>What authorized source would verify or disprove it?<textarea value={source} onChange={e=>setSource(e.target.value)}/></label>
    <label>What clarifying follow-up did you ask your AI assistant?<textarea value={followUp} onChange={e=>setFollowUp(e.target.value)}/></label>
    <label>How did this follow-up improve the decision, rather than only lengthen the response?<textarea value={changed} onChange={e=>setChanged(e.target.value)}/></label>
    <h3>5. Write your own decision memo</h3>
    <label>Record alternatives, supplied evidence, tradeoffs, uncertainty, and provisional rationale<textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={6}/></label>
    <label>Who is accountable for the final decision and any approval?<textarea value={owner} onChange={e=>setOwner(e.target.value)}/></label>
    <div className="p2-decision-actions">
      {enrollmentId&&project
        ? <button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save to My Project Record'}</button>
        : <p>Founder preview: copy your exercise. No learner save is simulated.</p>}
      <button type="button" onClick={()=>void copy(JSON.stringify(record,null,2),'Your Lesson 1.4 decision evidence was copied.')}>Copy Lesson 1.4 evidence</button>
      <p role="status">{message||(complete?'Ready for review.':'Complete the six request elements and decision record before saving.')}</p>
    </div>
  </section>
}
