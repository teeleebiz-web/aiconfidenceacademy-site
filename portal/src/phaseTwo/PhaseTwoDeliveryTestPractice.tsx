import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "context": "Continuing project, pathway and audience",
  "savedArtifact": "Saved Journey 4 offer, sample, flow and 4.5 test plan",
  "testMode": "Permitted external test or documented scenario and actual validation limits",
  "permission": "Participation permission, minimum necessary information and privacy",
  "learningQuestion": "Retained learning question, task and decision rule",
  "conditions": "Participant role, inputs, materials and test conditions",
  "promiseCheck": "Promise understanding: result, evidence and limits",
  "accessCheck": "Sample access: route, result, evidence and limits",
  "actionCheck": "Intended action: result, missing inputs and evidence",
  "supportCheck": "Support route, human owner, result and unverified response assumptions",
  "observations": "Observations separated from interpretation, assumption and simulation",
  "problem": "One material content or delivery problem and supporting evidence",
  "beforeSample": "Before sample or instruction showing the problem",
  "revision": "Chosen correction and complete revised sample or instruction",
  "justification": "Human reason for choosing this revision and rejected AI suggestions",
  "retest": "Retest task, conditions, result and evidence labels",
  "comparison": "What improved, what did not, and comparison limits",
  "offerEvidence": "Retained offer and audience evidence with unresolved validation",
  "formatSample": "Retained format choice, usable sample and experience outline",
  "flowOwnership": "Retained tested delivery path, support and accountable ownership",
  "trustChecks": "Trust checks: claims, privacy, access, review and open dependencies",
  "businessReview": "Responsible Business Review, cost assumptions and any effort changes",
  "testResults": "Final test results, evidence references and unresolved limitations",
  "reviewDecision": "Human continue, revise or pause decision, reason and next evidence",
  "completion": "Revised artifact shown, usable sample, tested path and Journey 5 handoff"
} as const
type Draft = Record<keyof typeof fields,string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k,''])) as Draft

export function PhaseTwoDeliveryTestPractice({enrollmentId,approvedAiRequest}:{enrollmentId?:string;approvedAiRequest:string}) {
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
      const artifact=record.sections.digital_delivery_artifact as {delivery_test_lesson_4_6?:{draft?:Partial<Draft>};offer_lesson_4_1?:unknown;experience_lesson_4_2?:unknown;content_voice_lesson_4_3?:unknown;delivery_lesson_4_4?:unknown;business_test_lesson_4_5?:unknown}|undefined
      const saved=artifact?.delivery_test_lesson_4_6
      if(saved?.draft){
        setDraft(Object.fromEntries(Object.keys(fields).map(k=>[k,typeof saved.draft?.[k as keyof Draft]==='string'?saved.draft[k as keyof Draft]:''])) as Draft)
      }else{
        setDraft(old=>({...old,context:record.project_title+' — Path '+record.project_path,
          savedArtifact:artifact&&(artifact.offer_lesson_4_1||artifact.experience_lesson_4_2||artifact.content_voice_lesson_4_3||artifact.delivery_lesson_4_4||artifact.business_test_lesson_4_5)?JSON.stringify({offer:artifact.offer_lesson_4_1,experience:artifact.experience_lesson_4_2,content_review:artifact.content_voice_lesson_4_3,delivery_map:artifact.delivery_lesson_4_4,test_and_cost_review:artifact.business_test_lesson_4_5},null,2):''}))
      }
    }).catch(()=>{if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
    return()=>{active=false}
  },[enrollmentId])
  const complete=Object.values(draft).every(v=>v.trim())&&checked
  const artifactComponents=['offer','audience_evidence','format_choice','sample','flow','ownership','trust_checks','business_review','test_results']
  const notes={...draft}
  const request=approvedAiRequest.replace('[notes]',JSON.stringify(notes,null,2))
  const evidence={lesson:'4.6',draft,test_observations:notes,complete_artifact:{offer:draft.offerEvidence,audience_evidence:draft.offerEvidence,format_choice:draft.formatSample,sample:draft.revision,flow:draft.flowOwnership,ownership:draft.flowOwnership,trust_checks:draft.trustChecks,business_review:draft.businessReview,test_results:draft.testResults},required_artifact_components:artifactComponents,applied_check:{revised_artifact:draft.revision,what_improved:draft.comparison,usable_sample_tested_path_and_handoff:draft.completion},human_review_decision:draft.reviewDecision,human_review_confirmed:checked,ai_request:request,scenario_establishes_actual_audience_validation:false,scenario_establishes_live_delivery_or_received_support:false,record_establishes_sales_or_demand:false,saved_record_grants_publication_permission:false}
  const recordText=JSON.stringify(evidence,null,2)
  function field(k:keyof Draft){return <label key={k}>{fields[k]}<textarea rows={['savedArtifact','beforeSample','revision','retest','completion'].includes(k)?5:3} value={draft[k]} onChange={e=>{setDraft(old=>({...old,[k]:e.target.value}));setChecked(false)}}/></label>}
  async function copy(text:string,message:string){try{await navigator.clipboard.writeText(text);setStatus(message)}catch{setStatus('Clipboard is unavailable. Select the displayed request or record to copy it.')}}
  async function save(){
    if(!enrollmentId||!project||!complete||saving)return
    setSaving(true);setStatus('')
    try{
      const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,patch:{digital_delivery_artifact:{delivery_test_lesson_4_6:evidence}},decisionNote:'Lesson 4.6 — '+draft.reviewDecision})
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'. Saving retains the human release decision and does not authorize publication.')
    }catch{setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally{setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-delivery-test-practice-title">
    <header><p className="eyebrow">Assemble • Test • Revise • Retest • Verify • Save</p><h2 id="p2-delivery-test-practice-title">Test, revise and retain the delivery artifact</h2><p>Continue the same Journey Four project and 4.5 test plan. Run appropriately permitted participation or a documented scenario. Keep actual audience validation open when no external participant is available.</p></header>
    <div><h3>1. Prepare the connected test</h3>{(['context','savedArtifact','testMode','permission','learningQuestion','conditions'] as const).map(field)}<p>Use the saved question and decision rule. Collect useful observations without unnecessary personal information. Label simulated responses; do not invent a participant, praise or sales.</p></div>
    <div><h3>2. Observe and choose one material correction</h3>{(['promiseCheck','accessCheck','actionCheck','supportCheck','observations','problem','beforeSample','revision','justification'] as const).map(field)}<p>Check promise understanding, access, the intended action and support. In the fictional case, an unclear labor-hours requirement blocks the calculation. Clarify required inputs and the missing-information stop point. Choose and justify the revision yourself.</p><label>Delivery test AI request<textarea readOnly rows={10} value={request}/></label><button type="button" onClick={()=>void copy(request,'Delivery test request copied. Choose and justify the correction yourself.')}>Copy delivery test AI request</button></div>
    <div><h3>3. Retest and compare the evidence</h3>{(['retest','comparison'] as const).map(field)}<p>FICTIONAL SCRIPTED RETEST: 2 supplied hours × $50/hour + $15 separate cost = $115 practice subtotal. Hours and rate are required; if missing, pause and verify. Trace message, labeled guide link, directions, fields, calculation, self-review, help route and completion. A paper scenario does not establish a live link, received support or actual audience validation.</p></div>
    <div><h3>4. Retain the complete artifact and decision</h3>{(['offerEvidence','formatSample','flowOwnership','trustChecks','businessReview','testResults','reviewDecision','completion'] as const).map(field)}<p>Retain offer, audience evidence, format choice, sample, flow, ownership, trust checks, business review and test results. Show the usable revised sample, tested delivery path and honest next-step decision. Keep provider delivery costs separate from practice-estimate figures.</p><label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked permission and evidence labels, selected and justified one material revision, retested comparable conditions, inspected the usable sample and delivery path, retained all nine artifact components and their limits, and recorded my human continue, revise or pause decision.</label></div>
    <div className="p2-workflow-practice-save">{enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save delivery test and complete artifact to My Project Record'}</button>:<p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}<button type="button" onClick={()=>void copy(recordText,'Lesson 4.6 delivery artifact copied.')}>Copy my Lesson 4.6 record</button><details><summary>Read or copy my delivery artifact record</summary><textarea aria-label="Lesson 4.6 delivery artifact record" readOnly rows={12} value={recordText}/></details><p role="status">{status||(complete?'Your revised artifact and decision are ready to save.':'Complete the test, revision, retest, artifact and human decision before saving.')}</p><p>Saving preserves earlier project work. Use the connected Journey Four workbook and carry this same artifact into Journey Five, beginning with Lesson 5.1.</p></div>
  </section>
}
