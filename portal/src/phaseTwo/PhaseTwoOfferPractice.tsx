import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "context": "Continuing project and Path A or Path B context",
  "audienceEvidence": "Journey 1 audience need and source labels",
  "adoptionContext": "Journey 3 retained plan and open dependencies",
  "audience": "Audience — buyer or defined internal user",
  "need": "Need — evidenced task, situation and barrier",
  "value": "Value — useful action without guaranteed outcomes",
  "contentService": "Content or Service — actual deliverable and human work",
  "format": "Format — selected presentation and access requirements",
  "responsibility": "Responsibility — provider review and user participation",
  "limits": "Limits — boundaries and outcomes outside control",
  "offerSentence": "My bounded offer sentence and exchange",
  "inclusions": "Inclusion list — supplied material, service and support",
  "exclusions": "Exclusion list — work and guarantees not supplied",
  "userResponsibility": "Buyer or internal user responsibility",
  "formatOne": "Format option 1 — use, access, effort and tradeoff",
  "formatTwo": "Format option 2 — use, access, effort and tradeoff",
  "simpleAlternative": "Simpler alternative — use, access, effort and tradeoff",
  "formatChoice": "Selected format and evidence-based reason",
  "capacity": "Stated delivery capacity — content, review, support and limits",
  "promiseCheck": "Promise-to-capacity check — each promise, evidence and gap",
  "aiReview": "AI suggestions kept, corrected or rejected",
  "audienceAssumptions": "Assumptions still requiring an audience test",
  "guaranteeCorrection": "Applied check — correct the unsupported income guarantee",
  "controlExplanation": "Explain a promised deliverable versus an outcome outside your control",
  "decisionNote": "Most important correction and the evidence behind it"
} as const
type Draft = Record<keyof typeof fields,string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k,''])) as Draft

export function PhaseTwoOfferPractice({enrollmentId,approvedAiRequest}:{enrollmentId?:string;approvedAiRequest:string}) {
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
      const artifact=record.sections.digital_delivery_artifact as {offer_lesson_4_1?:{draft?:Partial<Draft>}}|undefined
      const saved=artifact?.offer_lesson_4_1
      if(saved?.draft){
        setDraft(Object.fromEntries(Object.keys(fields).map(k=>[k,typeof saved.draft?.[k as keyof Draft]==='string'?saved.draft[k as keyof Draft]:''])) as Draft)
      }else{
        const model=record.sections.professional_ai_operating_model as {audience_need_lesson_1_2?:unknown}|undefined
        const adoption=record.sections.leadership_and_adoption_plan as {adoption_rehearsal_lesson_3_6?:unknown}|undefined
        setDraft(old=>({...old,context:record.project_title+' — Path '+record.project_path,
          audienceEvidence:model?.audience_need_lesson_1_2?JSON.stringify(model.audience_need_lesson_1_2,null,2):'',
          adoptionContext:adoption?.adoption_rehearsal_lesson_3_6?JSON.stringify(adoption.adoption_rehearsal_lesson_3_6,null,2):record.sections.leadership_and_adoption_plan?JSON.stringify(record.sections.leadership_and_adoption_plan,null,2):''}))
      }
    }).catch(()=>{if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
    return()=>{active=false}
  },[enrollmentId])
  const complete=Object.values(draft).every(v=>v.trim())&&checked
  const frame={audience:draft.audience,need:draft.need,value:draft.value,content_or_service:draft.contentService,format:draft.format,responsibility:draft.responsibility,limits:draft.limits}
  const request=approvedAiRequest.replace('[brief]',JSON.stringify({context:draft.context,audience_evidence:draft.audienceEvidence,adoption_context:draft.adoptionContext,frame,capacity:draft.capacity,format_options:[draft.formatOne,draft.formatTwo,draft.simpleAlternative],assumptions:draft.audienceAssumptions},null,2))
  const evidence={lesson:'4.1',draft,responsible_offer_frame:frame,offer_sentence:draft.offerSentence,scope:{inclusions:draft.inclusions,exclusions:draft.exclusions,user_responsibility:draft.userResponsibility},format_comparison:{first:draft.formatOne,second:draft.formatTwo,simpler:draft.simpleAlternative,selected:draft.format,reason:draft.formatChoice},capacity_check:draft.promiseCheck,audience_test_assumptions:draft.audienceAssumptions,unsupported_guarantee_correction:draft.guaranteeCorrection,ai_request:request,human_review_confirmed:checked,saved_draft_establishes_demand:false,saved_record_grants_publication_permission:false}
  const recordText=JSON.stringify(evidence,null,2)
  function field(k:keyof Draft){return <label key={k}>{fields[k]}<textarea rows={k==='audienceEvidence'||k==='adoptionContext'||k==='promiseCheck'?5:3} value={draft[k]} onChange={e=>{setDraft(old=>({...old,[k]:e.target.value}));setChecked(false)}}/></label>}
  async function copy(text:string,message:string){try{await navigator.clipboard.writeText(text);setStatus(message)}catch{setStatus('Clipboard is unavailable. Select the displayed request or record to copy it.')}}
  async function save(){
    if(!enrollmentId||!project||!complete||saving)return
    setSaving(true);setStatus('')
    try{
      const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,patch:{digital_delivery_artifact:{offer_lesson_4_1:evidence}},decisionNote:'Lesson 4.1 — '+draft.decisionNote})
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'. Audience-test assumptions remain open; this draft does not authorize publication.')
    }catch{setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally{setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-offer-practice-title">
    <header><p className="eyebrow">Use AI • Check the promise • Define scope • Save</p><h2 id="p2-offer-practice-title">Define your responsible offer</h2>
      <p>Continue the same project. Use existing audience evidence and retain its source labels. Path A can define an internal service; Path B can define a buyer offer. Use fictional, public or appropriately authorized inputs in your chosen AI assistant.</p></header>
    <div><h3>1. Bring forward the audience need</h3>{(['context','audienceEvidence','adoptionContext'] as const).map(field)}<p>If earlier evidence is missing, state what is missing and how it will be resolved. Do not invent demand, acceptance or permission.</p></div>
    <div><h3>2. Complete the Responsible Offer Frame</h3>{(['audience','need','value','contentService','format','responsibility','limits','offerSentence','inclusions','exclusions','userResponsibility'] as const).map(field)}
      <p>An offer states the promise and exchange. A product is the item supplied; a service includes human work; delivery connects the supporting activities. Promise the work you can provide, with responsibility and limits visible.</p></div>
    <div><h3>3. Compare formats and check capacity</h3>{(['formatOne','formatTwo','simpleAlternative','formatChoice','capacity'] as const).map(field)}
      <p>Compare the same need across two formats and a simpler alternative. Consider user action, access, explanation, review and support. Keep untested preferences labeled as assumptions.</p>
      <label>Offer organization AI request<textarea readOnly rows={10} value={request}/></label><button type="button" onClick={()=>void copy(request,'Offer request copied. Check the response against your evidence and capacity.')}>Copy offer AI request</button>{(['aiReview','promiseCheck','audienceAssumptions'] as const).map(field)}</div>
    <div><h3>4. Correct the guarantee and retain your offer</h3><p>FICTIONAL APPLIED CHECK: The reviewed template includes field instructions, one completed fictional example and a self-review checklist. No income or business-success evidence is supplied. Correct: “This template guarantees higher income and business success.” Explain the promised deliverable and the outcome outside your control.</p>{(['guaranteeCorrection','controlExplanation','decisionNote'] as const).map(field)}
      <label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked every promise against evidence and capacity, compared the three formats, corrected the guarantee and retained scope, user responsibility and audience-test assumptions.</label></div>
    <div className="p2-workflow-practice-save">{enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save offer and scope to My Project Record'}</button>:<p>Copy your work to keep it. Saving to My Project Record requires an active enrollment.</p>}
      <button type="button" onClick={()=>void copy(recordText,'Lesson 4.1 offer and scope copied with its open assumptions.')}>Copy my Lesson 4.1 record</button>
      <details><summary>Read or copy my offer record</summary><textarea aria-label="Lesson 4.1 offer record" readOnly rows={12} value={recordText}/></details>
      <p role="status">{status||(complete?'Your offer and scope are ready to save for review.':'Complete the offer frame, scope, three-format comparison, promise check and applied correction before saving.')}</p>
      <p>Saving preserves earlier project work. Use the associated Journey Four workbook section. Carry the checked offer and scope into Lesson 4.2.</p></div>
  </section>
}
