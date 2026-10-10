import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoCapstonePractice.css'

type Candidate={artifact:string;feasibility:string;value:string;consequences:string;permission:string}
const blank=():Candidate=>({artifact:'',feasibility:'',value:'',consequences:'',permission:''})
const aiRequest='Review this project using Function, Owner, Customer, Use Case and Scope. Identify missing solution-concept fields and suggest a smaller complete artifact where needed. Do not assume approval to deploy. Draft: '

export function PhaseTwoCapstonePractice({enrollmentId}:{enrollmentId?:string}) {
  const [alternatives,setAlternatives]=useState<Candidate[]>([blank(),blank(),blank()])
  const [chosen,setChosen]=useState(0)
  const [fn,setFn]=useState('')
  const [owner,setOwner]=useState('')
  const [customer,setCustomer]=useState('')
  const [useCase,setUseCase]=useState('')
  const [scope,setScope]=useState('')
  const [existingNeed,setExistingNeed]=useState('')
  const [aiRole,setAiRole]=useState('')
  const [inputs,setInputs]=useState('')
  const [success,setSuccess]=useState('')
  const [exclusions,setExclusions]=useState('')
  const [charter,setCharter]=useState('')
  const [test,setTest]=useState('')
  const [approval,setApproval]=useState('')
  const [aiCorrection,setAiCorrection]=useState('')
  const [decision,setDecision]=useState('')
  const [project,setProject]=useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
  const [status,setStatus]=useState('')
  const [saving,setSaving]=useState(false)
  useEffect(()=>{
    if(!enrollmentId)return
    let alive=true
    void loadPhaseTwoProject(enrollmentId).then(r=>{
      if(alive&&r)setProject({path:r.project_path,title:r.project_title})
    }).catch(()=>{if(alive)setStatus('Unable to load your Project Record. Copy your answers while it is unavailable.')})
    return ()=>{alive=false}
  },[enrollmentId])
  const update=(i:number,field:keyof Candidate,v:string)=>setAlternatives(a=>a.map((x,j)=>i===j?{...x,[field]:v}:x))
  const prompt=aiRequest+['Function: '+fn,'Owner: '+owner,'Customer: '+customer,'Use Case: '+useCase,'Scope: '+scope,'Need: '+existingNeed,'Proposed first artifact: '+alternatives[chosen].artifact,'Exclusions: '+exclusions].join('\n')
  const complete=alternatives.every(a=>Object.values(a).every(v=>v.trim()))&&
    [fn,owner,customer,useCase,scope,existingNeed,aiRole,inputs,success,exclusions,charter,test,approval,decision].every(x=>x.trim())
  const record={lesson:'1.5',source_lessons:['1.1','1.2','1.3','1.4'],alternatives,selected_index:chosen,
    focus:{function:fn,owner,customer,use_case:useCase,scope},
    concept:{existing_need:existingNeed,ai_role_and_human_review:aiRole,authorized_inputs:inputs,
      success_criteria:success,exclusions,approval_dependencies:approval},
    one_paragraph_charter:charter,selection_rationale:decision,first_test:test,
    reviewed_ai_correction:aiCorrection,fictional_practice_not_approval:true}
  const copy=async(value:string,msg:string)=>{
    try{await navigator.clipboard.writeText(value);setStatus(msg)}
    catch{setStatus('Clipboard unavailable. Select the visible text to copy manually.')}
  }
  async function save(){
    if(!enrollmentId||!project||!complete)return
    setSaving(true);setStatus('')
    try{
      const result=await savePhaseTwoProjectUpdate({
        enrollmentId,path:project.path,title:project.title,
        patch:{professional_ai_operating_model:{focus_capstone_lesson_1_5:record}},
        decisionNote:'Lesson 1.5 — FOCUS capstone charter, three alternatives, boundaries and first test'
      })
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'.')
    }catch{setStatus('Your work has not been saved. Keep this page open, retry or copy a backup.')}
    finally{setSaving(false)}
  }
  return <section className="p2-capstone-practice" aria-labelledby="p2-capstone-heading">
    <header><p className="eyebrow">Compare • Scope • Test • Save</p>
      <h2 id="p2-capstone-heading">Design one finishable capstone artifact</h2>
      <p>Continue the same project from Lessons 1.1–1.4. A small completed demonstration is better evidence than an untested large system. Your AI assistant can critique a draft; it cannot authorize real-world deployment.</p>
    </header>
    <h3>1. Compare three possible artifacts</h3>
    {alternatives.map((a,i)=><fieldset key={i}>
      <legend>Candidate artifact {i+1}</legend>
      <label>What would you actually deliver?<textarea value={a.artifact} onChange={e=>update(i,'artifact',e.target.value)}/></label>
      <label>Can you realistically finish it with available time and tools?<textarea value={a.feasibility} onChange={e=>update(i,'feasibility',e.target.value)}/></label>
      <label>What useful result could it demonstrate, without inventing demand?<textarea value={a.value} onChange={e=>update(i,'value',e.target.value)}/></label>
      <label>What happens if the result is wrong or misleading?<textarea value={a.consequences} onChange={e=>update(i,'consequences',e.target.value)}/></label>
      <label>Which permissions, data or dependencies are required?<textarea value={a.permission} onChange={e=>update(i,'permission',e.target.value)}/></label>
    </fieldset>)}
    <h3>2. Choose and apply the FOCUS Capstone Frame</h3>
    <label>Which first artifact will you build?<select value={chosen} onChange={e=>setChosen(Number(e.target.value))}>{alternatives.map((_,i)=><option key={i} value={i}>Candidate {i+1}</option>)}</select></label>
    <label>Function — what does this artifact do?<textarea value={fn} onChange={e=>setFn(e.target.value)}/></label>
    <label>Owner — who approves and checks the result?<textarea value={owner} onChange={e=>setOwner(e.target.value)}/></label>
    <label>Customer — who is served? Mark fictional users clearly.<textarea value={customer} onChange={e=>setCustomer(e.target.value)}/></label>
    <label>Use Case — which safe input becomes what reviewable output?<textarea value={useCase} onChange={e=>setUseCase(e.target.value)}/></label>
    <label>Scope — what small first version will you finish?<textarea value={scope} onChange={e=>setScope(e.target.value)}/></label>
    <h3>3. Build the solution concept</h3>
    <label>Previous lesson's audience need and current workflow<textarea value={existingNeed} onChange={e=>setExistingNeed(e.target.value)}/></label>
    <label>AI role or no AI and the human review point<textarea value={aiRole} onChange={e=>setAiRole(e.target.value)}/></label>
    <label>Available authorized input information and tools<textarea value={inputs} onChange={e=>setInputs(e.target.value)}/></label>
    <label>What measurable evidence would show this artifact is finished and useful?<textarea value={success} onChange={e=>setSuccess(e.target.value)}/></label>
    <label>What is deliberately excluded? State contracts, money and client communications where relevant.<textarea value={exclusions} onChange={e=>setExclusions(e.target.value)}/></label>
    <h3>4. Review with your own AI assistant</h3>
    <p>Copy the request to your selected AI tool on a computer, tablet or phone. Use fictional or authorized sanitized information. Reject invented permissions or inflated promises.</p>
    <textarea readOnly aria-label="FOCUS AI request" rows={8} value={prompt}/>
    <button type="button" onClick={()=>void copy(prompt,'FOCUS request copied. Review and verify your AI tool’s suggestions.')}>Copy FOCUS AI request</button>
    <label>Which AI suggestion did you correct or remove?<textarea value={aiCorrection} onChange={e=>setAiCorrection(e.target.value)}/></label>
    <h3>5. Commit to a finishable charter and test</h3>
    <label>One-paragraph project charter<textarea value={charter} onChange={e=>setCharter(e.target.value)} rows={6}/></label>
    <label>Why choose this artifact over the other two?<textarea value={decision} onChange={e=>setDecision(e.target.value)}/></label>
    <label>One first test: safe input, expected output, reviewer, passing and failing conditions<textarea value={test} onChange={e=>setTest(e.target.value)} rows={5}/></label>
    <label>Which real-world decision or resource requires another person's approval?<textarea value={approval} onChange={e=>setApproval(e.target.value)}/></label>
    <div className="p2-capstone-actions">
      {enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save to My Project Record'}</button>
        :<p>Founder preview: your work can be copied. No learner save is simulated.</p>}
      <button type="button" onClick={()=>void copy(JSON.stringify(record,null,2),'Lesson 1.5 capstone evidence copied.')}>Copy my Lesson 1.5 evidence</button>
      <p role="status">{status||(complete?'Your capstone charter is ready for review.':'Complete the three options, FOCUS fields, charter and first test before saving.')}</p>
    </div>
  </section>
}
