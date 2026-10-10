import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "context": "Continuing project, pathway and audience",
  "savedArtifact": "Saved offer, 4.2 experience and 4.3 content review",
  "expectations": "Approved price or internal service expectations and unresolved policy inputs",
  "participationTime": "Participation time, review expectations and evidence labels",
  "supportAssumptions": "Support route, response assumptions, human correction and capacity checks",
  "outer_discover": "Outer flow \u2014 Discover: question, information, AI support, human owner and expected response",
  "outer_understand": "Outer flow \u2014 Understand: question, information, AI support, human owner and expected response",
  "outer_choose": "Outer flow \u2014 Choose: question, information, AI support, human owner and expected response",
  "outer_receive": "Outer flow \u2014 Receive: question, information, AI support, human owner and expected response",
  "outer_begin": "Outer flow \u2014 Begin: question, information, AI support, human owner and expected response",
  "outer_participate": "Outer flow \u2014 Participate: question, information, AI support, human owner and expected response",
  "outer_support": "Outer flow \u2014 Support: question, information, AI support, human owner and expected response",
  "outer_complete": "Outer flow \u2014 Complete: question, information, AI support, human owner and expected response",
  "outer_follow_up": "Outer flow \u2014 Follow-up: question, information, AI support, human owner and expected response",
  "inner_enter": "Participation \u2014 Enter: question, information, AI support, human owner and expected response",
  "inner_orient": "Participation \u2014 Orient: question, information, AI support, human owner and expected response",
  "inner_engage": "Participation \u2014 Engage: question, information, AI support, human owner and expected response",
  "inner_respond": "Participation \u2014 Respond: question, information, AI support, human owner and expected response",
  "inner_review": "Participation \u2014 Review: question, information, AI support, human owner and expected response",
  "inner_support": "Participation \u2014 Support: question, information, AI support, human owner and expected response",
  "inner_complete": "Participation \u2014 Complete: question, information, AI support, human owner and expected response",
  "inner_continue": "Participation \u2014 Continue: question, information, AI support, human owner and expected response",
  "failureCorrections": "Two failure points, responsible owners, expected responses and corrected instructions",
  "verification": "Policy, delivery, privacy and access checks; unresolved assumptions; AI review",
  "traceDecision": "Discovery-to-follow-up trace, help and access-failure explanation, human decision note"
} as const
type Draft = Record<keyof typeof fields,string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k,''])) as Draft

export function PhaseTwoDeliveryMapPractice({enrollmentId,approvedAiRequest}:{enrollmentId?:string;approvedAiRequest:string}) {
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
      const artifact=record.sections.digital_delivery_artifact as {delivery_lesson_4_4?:{draft?:Partial<Draft>};offer_lesson_4_1?:unknown;experience_lesson_4_2?:unknown;content_voice_lesson_4_3?:unknown}|undefined
      const saved=artifact?.delivery_lesson_4_4
      if(saved?.draft){
        setDraft(Object.fromEntries(Object.keys(fields).map(k=>[k,typeof saved.draft?.[k as keyof Draft]==='string'?saved.draft[k as keyof Draft]:''])) as Draft)
      }else{
        setDraft(old=>({...old,context:record.project_title+' — Path '+record.project_path,
          savedArtifact:artifact&&(artifact.offer_lesson_4_1||artifact.experience_lesson_4_2||artifact.content_voice_lesson_4_3)?JSON.stringify({offer:artifact.offer_lesson_4_1,experience:artifact.experience_lesson_4_2,content_review:artifact.content_voice_lesson_4_3},null,2):''}))
      }
    }).catch(()=>{if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
    return()=>{active=false}
  },[enrollmentId])
  const complete=Object.values(draft).every(v=>v.trim())&&checked
  const outerStages=['discover','understand','choose','receive','begin','participate','support','complete','follow-up']
  const innerStages=['enter','orient','engage','respond','review','support','complete','continue']
  const mapStage=(prefix:string,stage:string)=>({stage,question_information_ai_support_human_owner_and_response:draft[(prefix+stage.replace('-','_')) as keyof Draft]})
  const connections=[{outer:'receive',inner:['enter']},{outer:'begin',inner:['orient']},{outer:'participate',inner:['engage','respond','review']},{outer:'support',inner:['support']},{outer:'complete',inner:['complete']},{outer:'follow-up',inner:['continue']}]
  const flow={context:draft.context,saved_artifact:draft.savedArtifact,expectations:draft.expectations,participation_and_review:draft.participationTime,support_and_response_assumptions:draft.supportAssumptions,outer_flow:outerStages.map(x=>mapStage('outer_',x)),participation_map:innerStages.map(x=>mapStage('inner_',x)),connections,failures_and_corrected_instructions:draft.failureCorrections,verification_and_open_assumptions:draft.verification}
  const request=approvedAiRequest.replace('[draft]',JSON.stringify(flow,null,2))
  const evidence={lesson:'4.4',draft,connected_delivery_map:flow,corrected_instructions:draft.failureCorrections,applied_check:{discovery_to_follow_up_trace_help_and_access_failure:draft.traceDecision},human_review_confirmed:checked,ai_request:request,scenario_establishes_live_delivery_or_customer_satisfaction:false,real_sensitive_customer_information_required:false,payment_or_platform_settings_created:false,saved_record_grants_publication_permission:false}
  const recordText=JSON.stringify(evidence,null,2)
  function field(k:keyof Draft){return <label key={k}>{fields[k]}<textarea rows={['savedArtifact','failureCorrections','verification','traceDecision'].includes(k)?5:3} value={draft[k]} onChange={e=>{setDraft(old=>({...old,[k]:e.target.value}));setChecked(false)}}/></label>}
  async function copy(text:string,message:string){try{await navigator.clipboard.writeText(text);setStatus(message)}catch{setStatus('Clipboard is unavailable. Select the displayed request or record to copy it.')}}
  async function save(){
    if(!enrollmentId||!project||!complete||saving)return
    setSaving(true);setStatus('')
    try{
      const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,patch:{digital_delivery_artifact:{delivery_lesson_4_4:evidence}},decisionNote:'Lesson 4.4 — '+draft.traceDecision})
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'. Saving retains the human release decision and does not authorize publication.')
    }catch{setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally{setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-delivery-map-practice-title">
    <header><p className="eyebrow">Map • Connect • Walk through • Correct • Verify • Save</p><h2 id="p2-delivery-map-practice-title">Connect customer flow and digital participation</h2><p>Continue the same offer, 4.2 experience and 4.3 reviewed sample. Use fictional, public or appropriately authorized inputs. Do not collect real sensitive customer information for practice.</p></header>
    <div><h3>1. Retain scope and delivery expectations</h3>{(['context','savedArtifact','expectations','participationTime','supportAssumptions'] as const).map(field)}<p>State approved pricing or internal service expectations, participation time, review expectations, privacy, accessible materials, feedback and a human correction route. Label estimates and support assumptions until verified. Do not create payment or platform settings.</p></div>
    <div><h3>2. Map the outer customer or service journey</h3>{outerStages.map(x=>field(('outer_'+x.replace('-','_')) as keyof Draft))}<p>Every stage records the person's question, information needed, possible AI support, accountable human owner and expected response or dependency.</p></div>
    <div><h3>3. Connect inner participation</h3>{innerStages.map(x=>field(('inner_'+x) as keyof Draft))}<p>Connect receipt to entry; beginning to orientation; participation to engage, respond and review; shared support and completion; follow-up to continuation.</p><label>Delivery map AI request<textarea readOnly rows={10} value={request}/></label><button type="button" onClick={()=>void copy(request,'Delivery review request copied. Inspect suggestions against approved policy, capacity and scope.')}>Copy delivery AI request</button></div>
    <div><h3>4. Trace one user and correct two failures</h3><p>FICTIONAL APPLIED CHECK: “Your guide is available” supplies no name or location. “Ask a question” supplies no route, owner or expected response. Correct both instructions and name the responsible owner. A 20-minute practice and initial acknowledgment within one business day are unverified scenario assumptions. No actual price, approved policy or live delivery evidence is supplied.</p>{(['failureCorrections','verification','traceDecision'] as const).map(field)}<label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I connected all stages, traced discovery to follow-up, corrected two failures, checked policy and delivery claims, retained human owners and labeled unresolved time, support, privacy and access assumptions.</label></div>
    <div className="p2-workflow-practice-save">{enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save delivery map and corrections to My Project Record'}</button>:<p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}<button type="button" onClick={()=>void copy(recordText,'Lesson 4.4 map and corrections copied.')}>Copy my Lesson 4.4 record</button><details><summary>Read or copy my delivery record</summary><textarea aria-label="Lesson 4.4 delivery record" readOnly rows={12} value={recordText}/></details><p role="status">{status||(complete?'Your connected map is ready to save for review.':'Complete all stages, expectations, corrections, verification and the trace before saving.')}</p><p>Saving preserves earlier project work. Use the connected Journey Four workbook and carry this artifact into Lesson 4.5.</p></div>
  </section>
}
