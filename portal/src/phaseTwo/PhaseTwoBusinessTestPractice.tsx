import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "context": "Continuing project, pathway and audience",
  "savedArtifact": "Saved offer, sample, content review and 4.4 delivery map",
  "responsibleReview": "Useful, clear, deliverable, responsible, sustainable and testable \u2014 evidence and gaps",
  "learningQuestion": "One prototype learning question",
  "participant": "Relevant participant or role and reason",
  "permission": "Participation permission, privacy and scenario label",
  "show": "Exact prototype material and bounded task to show",
  "feedbackQuestions": "Feedback questions about understanding, use and expectations",
  "evidenceStandard": "Evidence to retain and standard for the learning question",
  "decisionRule": "Predefined continue, revise or pause rule",
  "feedbackLabels": "Observed feedback, interpretations, assumptions and simulated responses",
  "deliveryUnit": "Delivery unit, period and cost allocation method",
  "toolCost": "Tool cost, supplied amount, source and measured or assumed label",
  "productionTime": "Production time, source and measured or assumed label",
  "reviewTime": "Human review time, source and measured or assumed label",
  "supportTime": "Support effort, source and measured or assumed label",
  "maintenanceTime": "Maintenance effort, source and measured or assumed label",
  "timeValue": "Time valuation method, source and overlap check",
  "baseCalculation": "Checked base calculation and comparison input source",
  "missingCosts": "Missing costs, applicability and required sources",
  "stressScenario": "Slower delivery or higher support inputs and checked calculation",
  "revisionEvidence": "Evidence that would justify narrowing or revising the offer",
  "hiddenCost": "One hidden cost and its effect on delivery",
  "unestablishedClaim": "One claim this test cannot establish",
  "reviewDecision": "Human continue, revise or pause decision, reason, AI corrections and next evidence"
} as const
type Draft = Record<keyof typeof fields,string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k,''])) as Draft

export function PhaseTwoBusinessTestPractice({enrollmentId,approvedAiRequest}:{enrollmentId?:string;approvedAiRequest:string}) {
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
      const artifact=record.sections.digital_delivery_artifact as {business_test_lesson_4_5?:{draft?:Partial<Draft>};offer_lesson_4_1?:unknown;experience_lesson_4_2?:unknown;content_voice_lesson_4_3?:unknown;delivery_lesson_4_4?:unknown}|undefined
      const saved=artifact?.business_test_lesson_4_5
      if(saved?.draft){
        setDraft(Object.fromEntries(Object.keys(fields).map(k=>[k,typeof saved.draft?.[k as keyof Draft]==='string'?saved.draft[k as keyof Draft]:''])) as Draft)
      }else{
        setDraft(old=>({...old,context:record.project_title+' — Path '+record.project_path,
          savedArtifact:artifact&&(artifact.offer_lesson_4_1||artifact.experience_lesson_4_2||artifact.content_voice_lesson_4_3||artifact.delivery_lesson_4_4)?JSON.stringify({offer:artifact.offer_lesson_4_1,experience:artifact.experience_lesson_4_2,content_review:artifact.content_voice_lesson_4_3,delivery_map:artifact.delivery_lesson_4_4},null,2):''}))
      }
    }).catch(()=>{if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
    return()=>{active=false}
  },[enrollmentId])
  const complete=Object.values(draft).every(v=>v.trim())&&checked
  const reviewCriteria=['useful','clear','deliverable','responsible','sustainable','testable']
  const notes={...draft,responsible_business_review_criteria:reviewCriteria}
  const request=approvedAiRequest.replace('[notes]',JSON.stringify(notes,null,2))
  const evidence={lesson:'4.5',draft,test_and_cost_notes:notes,applied_check:{revision_evidence:draft.revisionEvidence,hidden_cost:draft.hiddenCost,unestablished_claim:draft.unestablishedClaim},human_review_decision:draft.reviewDecision,human_review_confirmed:checked,ai_request:request,simulated_feedback_establishes_willingness_to_pay:false,scenario_validates_demand:false,cost_model_guarantees_commercial_return:false,saved_record_grants_publication_permission:false}
  const recordText=JSON.stringify(evidence,null,2)
  function field(k:keyof Draft){return <label key={k}>{fields[k]}<textarea rows={['savedArtifact','responsibleReview','baseCalculation','stressScenario','reviewDecision'].includes(k)?5:3} value={draft[k]} onChange={e=>{setDraft(old=>({...old,[k]:e.target.value}));setChecked(false)}}/></label>}
  async function copy(text:string,message:string){try{await navigator.clipboard.writeText(text);setStatus(message)}catch{setStatus('Clipboard is unavailable. Select the displayed request or record to copy it.')}}
  async function save(){
    if(!enrollmentId||!project||!complete||saving)return
    setSaving(true);setStatus('')
    try{
      const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,patch:{digital_delivery_artifact:{business_test_lesson_4_5:evidence}},decisionNote:'Lesson 4.5 — '+draft.reviewDecision})
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'. Saving retains the human release decision and does not authorize publication.')
    }catch{setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally{setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-business-test-practice-title">
    <header><p className="eyebrow">Review • Plan • Calculate • Stress • Verify • Save</p><h2 id="p2-business-test-practice-title">Prepare the prototype test and delivery cost review</h2><p>Continue the same offer, sample, reviewed content and 4.4 delivery map. Use appropriately permitted participation and information, or label the scenario. AI can organize feedback; it cannot validate demand alone.</p></header>
    <div><h3>1. Apply the Responsible Business Review</h3>{(['context','savedArtifact','responsibleReview'] as const).map(field)}<p>Useful, clear, deliverable, responsible, sustainable and testable: record evidence and gaps for every question.</p></div>
    <div><h3>2. Plan one bounded prototype test</h3>{(['learningQuestion','participant','permission','show','feedbackQuestions','evidenceStandard','decisionRule','feedbackLabels'] as const).map(field)}<p>Define the evidence and continue, revise or pause rule before collecting feedback. Distinguish observation, interpretation, assumption and simulation. Simulated praise cannot establish willingness to pay.</p></div>
    <div><h3>3. Count and stress delivery effort</h3>{(['deliveryUnit','toolCost','productionTime','reviewTime','supportTime','maintenanceTime','timeValue','baseCalculation','missingCosts','stressScenario'] as const).map(field)}<p>FICTIONAL CHECK: 70 minutes at an assumed $30/hour is $35; plus a $4 tool allocation gives $39. Against an illustrative $60 comparison, $21 remains before omitted costs. Review at 40 minutes and support at 30 produce 110 minutes, $55 time value and $59 subtotal, leaving $1. Every input is invented. These are conditional comparisons, not actual prices, wages, sales or verified profit.</p><label>Test and cost AI request<textarea readOnly rows={10} value={request}/></label><button type="button" onClick={()=>void copy(request,'Test and cost request copied. Check sources, arithmetic and evidence labels yourself.')}>Copy test and cost AI request</button></div>
    <div><h3>4. Verify and retain a human decision</h3>{(['revisionEvidence','hiddenCost','unestablishedClaim','reviewDecision'] as const).map(field)}<label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked permission, evidence labels, every supplied number and calculation, all delivery cost categories, missing costs and the stress scenario. I identified revision evidence, a hidden cost and an unestablished claim, and retained my human decision.</label></div>
    <div className="p2-workflow-practice-save">{enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save test plan and cost review to My Project Record'}</button>:<p>Copy your work to keep it. Saving to My Project Record requires an active enrollment.</p>}<button type="button" onClick={()=>void copy(recordText,'Lesson 4.5 test and cost review copied.')}>Copy my Lesson 4.5 record</button><details><summary>Read or copy my test and cost record</summary><textarea aria-label="Lesson 4.5 test and cost record" readOnly rows={12} value={recordText}/></details><p role="status">{status||(complete?'Your test and cost review is ready to save.':'Complete the review, test plan, cost checks and human decision before saving.')}</p><p>Saving preserves earlier project work. Use the connected Journey Four workbook and carry this same artifact into Lesson 4.6.</p></div>
  </section>
}
