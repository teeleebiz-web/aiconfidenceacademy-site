import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "context": "Continuing project and Path A or Path B context",
  "offerContext": "Saved 4.1 offer, selected format, scope and open dependencies",
  "staffResource": "Reference to 3.4 staff practice resource or a stated gap",
  "person": "Person — intended audience or internal user",
  "situation": "Situation — when and where the resource is used",
  "purpose": "Purpose — task the resource supports",
  "result": "Result — one observable action or usable output",
  "evidence": "Evidence — how completion will be demonstrated",
  "boundary": "Boundary — content, support, revisions and excluded work",
  "formatReason": "Selected format and why it serves the need",
  "orientation": "Orientation and connection — purpose, inputs and how to begin",
  "explanation": "Explanation — concepts and directions needed for the action",
  "example": "Worked example — show the action with checked inputs",
  "practice": "Practice — a supported attempt with enough information",
  "review": "Review — a clear standard and correction route",
  "application": "Application — use the process on permitted project inputs",
  "continuation": "Continuation — next action and unresolved dependencies",
  "sample": "Small complete sample — explanation, example, application and review",
  "accuracyCheck": "Factual accuracy, arithmetic and source-permission checks",
  "accessibilityCheck": "Accessibility checks performed and remaining access assumptions",
  "aiReview": "AI design suggestions kept, corrected or rejected",
  "demonstration": "Applied check — demonstrate the action and label the evidence",
  "removedSection": "Applied check — removed section, reason and revised sample",
  "openAssumptions": "Audience-test, access, support and permission assumptions still open",
  "decisionNote": "Most important correction and the evidence behind it"
} as const
type Draft = Record<keyof typeof fields,string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k,''])) as Draft

export function PhaseTwoExperienceDesignPractice({enrollmentId,approvedAiRequest}:{enrollmentId?:string;approvedAiRequest:string}) {
  const [draft,setDraft]=useState<Draft>(blank)
  const [checked,setChecked]=useState(false)
  const [project,setProject]=useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
  const [status,setStatus]=useState('')
  const [saving,setSaving]=useState(false)
  useEffect(()=>{
    setDraft(blank());setChecked(false);setProject(null);setStatus('')
    if(!enrollmentId)return
    let active=true
    void loadPhaseTwoProject(enrollmentId).then(record=>{
      if(!active||!record)return
      setProject({path:record.project_path,title:record.project_title})
      const artifact=record.sections.digital_delivery_artifact as {experience_lesson_4_2?:{draft?:Partial<Draft>};offer_lesson_4_1?:unknown}|undefined
      const saved=artifact?.experience_lesson_4_2
      if(saved?.draft){
        setDraft(Object.fromEntries(Object.keys(fields).map(k=>[k,typeof saved.draft?.[k as keyof Draft]==='string'?saved.draft[k as keyof Draft]:''])) as Draft)
      }else{
        const adoption=record.sections.leadership_and_adoption_plan as {readiness_lesson_3_4?:unknown}|undefined
        setDraft(old=>({...old,context:record.project_title+' — Path '+record.project_path,
          offerContext:artifact?.offer_lesson_4_1?JSON.stringify(artifact.offer_lesson_4_1,null,2):'',
          staffResource:adoption?.readiness_lesson_3_4?JSON.stringify(adoption.readiness_lesson_3_4,null,2):''}))
      }
    }).catch(()=>{if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
    return()=>{active=false}
  },[enrollmentId])
  const complete=Object.values(draft).every(v=>v.trim())&&checked
  const frame={person:draft.person,situation:draft.situation,purpose:draft.purpose,result:draft.result,evidence:draft.evidence,boundary:draft.boundary}
  const outline={orientation_and_connection:draft.orientation,explanation:draft.explanation,example:draft.example,practice:draft.practice,review:draft.review,application:draft.application,continuation:draft.continuation}
  const request=approvedAiRequest.replace('[inputs]',JSON.stringify({context:draft.context,saved_offer_and_scope:draft.offerContext,staff_resource_reference:draft.staffResource,frame,format_reason:draft.formatReason,outline,open_assumptions:draft.openAssumptions},null,2))
  const evidence={lesson:'4.2',draft,audience_purpose_result_frame:frame,experience_outline:outline,complete_sample:draft.sample,staff_resource_reference:draft.staffResource,checks:{accuracy:draft.accuracyCheck,accessibility:draft.accessibilityCheck,ai_review:draft.aiReview},applied_check:{demonstration:draft.demonstration,removed_section:draft.removedSection},open_assumptions:draft.openAssumptions,ai_request:request,human_review_confirmed:checked,scenario_establishes_audience_usefulness:false,saved_record_grants_publication_permission:false}
  const recordText=JSON.stringify(evidence,null,2)
  function field(k:keyof Draft){return <label key={k}>{fields[k]}<textarea rows={['offerContext','staffResource','sample','demonstration'].includes(k)?5:3} value={draft[k]} onChange={e=>{setDraft(old=>({...old,[k]:e.target.value}));setChecked(false)}}/></label>}
  async function copy(text:string,message:string){try{await navigator.clipboard.writeText(text);setStatus(message)}catch{setStatus('Clipboard is unavailable. Select the displayed request or record to copy it.')}}
  async function save(){
    if(!enrollmentId||!project||!complete||saving)return
    setSaving(true);setStatus('')
    try{
      const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,patch:{digital_delivery_artifact:{experience_lesson_4_2:evidence}},decisionNote:'Lesson 4.2 — '+draft.decisionNote})
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'. Actual audience usefulness remains open; saving does not authorize publication.')
    }catch{setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally{setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-experience-practice-title">
    <header><p className="eyebrow">Design • Build a sample • Demonstrate • Review • Save</p><h2 id="p2-experience-practice-title">Design a useful experience and complete sample</h2>
      <p>Continue the same project and the saved offer from 4.1. Use fictional, public or appropriately authorized inputs in your chosen AI assistant. Reference the 3.4 staff resource where it already serves the same function.</p></header>
    <div><h3>1. Define the person and observable result</h3>{(['context','offerContext','staffResource','person','situation','purpose','result','evidence','boundary','formatReason'] as const).map(field)}<p>If earlier evidence or a relevant resource is missing, state the gap. Keep the selected format, included support, revisions and exclusions aligned with the offer.</p></div>
    <div><h3>2. Sequence the experience around the action</h3>{(['orientation','explanation','example','practice','review','application','continuation'] as const).map(field)}
      <p>The Experience Arc is orient, learn, practice, review, apply and continue. Teaching also makes connection and demonstration explicit. Every step should help the person produce and check the intended result.</p>
      <label>Experience design AI request<textarea readOnly rows={10} value={request}/></label><button type="button" onClick={()=>void copy(request,'Experience request copied. Inspect the response against the saved offer and scope.')}>Copy experience AI request</button></div>
    <div><h3>3. Build and check one complete sample</h3>{(['sample','accuracyCheck','accessibilityCheck','aiReview'] as const).map(field)}
      <p>A complete sample includes explanation, a worked example, application and review. Check facts, arithmetic, labeled fields, readable instructions and essential spoken equivalents. Record what was actually checked.</p></div>
    <div><h3>4. Demonstrate the result and remove unrelated length</h3><p>FICTIONAL APPLIED CHECK: Demonstrate the estimate practice using 2 hours at $50/hour plus a $15 separate cost. State the training subtotal, calculation, excluded costs and review. The figures are invented; taxes, discounts and other costs are not supplied. Remove an AI-history section that does not help prepare the estimate and describe the revised sample. Apply the same result-and-relevance check to your project.</p>{(['demonstration','removedSection','openAssumptions','decisionNote'] as const).map(field)}
      <label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked the complete sample, demonstrated the action, reviewed facts and access, removed unrelated length and retained scope, prior resource references and open assumptions.</label></div>
    <div className="p2-workflow-practice-save">{enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save sample and outline to My Project Record'}</button>:<p>Copy your work to keep it. Saving to My Project Record requires an active enrollment.</p>}
      <button type="button" onClick={()=>void copy(recordText,'Lesson 4.2 sample and outline copied with its review evidence and open assumptions.')}>Copy my Lesson 4.2 record</button>
      <details><summary>Read or copy my experience record</summary><textarea aria-label="Lesson 4.2 experience record" readOnly rows={12} value={recordText}/></details>
      <p role="status">{status||(complete?'Your sample and outline are ready to save for review.':'Complete the frame, outline, sample, factual and accessibility checks, action demonstration and removal decision before saving.')}</p>
      <p>Saving preserves the earlier offer and project work. Use the connected Journey Four workbook. Carry the sample and outline into Lesson 4.3.</p></div>
  </section>
}
