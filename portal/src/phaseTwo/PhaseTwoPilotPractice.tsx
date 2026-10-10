import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "context": "Change context and continuing project",
  "carryForward": "Readiness support and open dependencies carried from Lesson 3.4",
  "purpose": "Purpose — bounded improvement to examine",
  "people": "People — participants and others affected",
  "concerns": "Concerns — evidence, simulation and unanswered questions",
  "communication": "Communication — reviewed message and its approval status",
  "participation": "Participation — task, limits and concern route",
  "support": "Support — readiness actions, owners and accessible resource",
  "humanControl": "Human control — review, correction, rejection and restart authority",
  "feedback": "Feedback — route, human owner and how it informs decisions",
  "risksLimits": "Risks and limits — exclusions and uncertainty",
  "nextReview": "Next review — actual date or defined event and decision owner",
  "scope": "Pilot scope — included task, duration or sample boundary and exclusions",
  "inputs": "Permitted inputs and approved environment",
  "permissionReference": "Actual human approval reference and precise scope — if granted",
  "approvalOwner": "Human role authorized to approve the pilot",
  "reviewOwner": "Human role reviewing results and monitoring owner",
  "correctionOwner": "Human role correcting or rejecting results",
  "stopOwner": "Human role authorized to stop the pilot",
  "escalation": "Escalation — human policy or expertise route",
  "baseline": "Baseline — comparable task, method, source and measurement status",
  "qualityMeasure": "Quality measure — what is checked and how it is recorded",
  "peopleMeasure": "People-experience measure — observable action and recording method",
  "stopTrigger": "Stop trigger — recognizable event, paused action and safe record",
  "dependencies": "Policy, support and expertise dependencies",
  "goal": "GOVERN — Goal",
  "owners": "GOVERN — Owners",
  "values": "GOVERN — Values",
  "evidence": "GOVERN — Evidence",
  "rules": "GOVERN — Rules",
  "notice": "GOVERN — Notice",
  "aiReview": "AI critique — verified changes and suggestions rejected",
  "testDesign": "Pilot test design — before, during and after; simulation stays explicit",
  "completionExplanation": "Applied check — who approves, stops and corrects; why productivity alone is insufficient",
  "decisionNote": "Most important pilot-plan revision and why it matters"
} as const
type Draft = Record<keyof typeof fields,string>
type Permission = 'pending_simulated' | 'authorized_reported_by_learner'
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k,''])) as Draft
export function PhaseTwoPilotPractice({enrollmentId,approvedAiRequest}:{enrollmentId?:string;approvedAiRequest:string}) {
  const [draft,setDraft]=useState<Draft>(blank)
  const [permission,setPermission]=useState<Permission>('pending_simulated')
  const [checked,setChecked]=useState(false)
  const [project,setProject]=useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
  const [status,setStatus]=useState('')
  const [saving,setSaving]=useState(false)
  useEffect(()=>{
    setDraft(blank());setPermission('pending_simulated');setChecked(false);setProject(null);setStatus('')
    if(!enrollmentId)return
    let active=true
    void loadPhaseTwoProject(enrollmentId).then(record=>{
      if(!active||!record)return
      setProject({path:record.project_path,title:record.project_title})
      const plan=record.sections.leadership_and_adoption_plan as {
        pilot_lesson_3_5?:{draft?:Partial<Draft>;permission_status?:Permission};
        readiness_lesson_3_4?:{draft?:{context?:string;actions?:string;alternative?:string;remaining?:string;testEvidence?:string};test_type?:string};
        change_message_lesson_3_3?:{final_message?:string;approval_status?:string;draft?:{open?:string}}
      }|undefined
      const saved=plan?.pilot_lesson_3_5
      if(saved?.draft){
        setDraft(Object.fromEntries(Object.keys(fields).map(k=>[k,typeof saved.draft?.[k as keyof Draft]==='string'?saved.draft[k as keyof Draft]:''])) as Draft)
        setPermission(saved.permission_status==='authorized_reported_by_learner'?'authorized_reported_by_learner':'pending_simulated')
      }else{
        const prior=plan?.readiness_lesson_3_4
        const message=plan?.change_message_lesson_3_3
        setDraft(old=>({...old,context:record.project_title,
          carryForward:prior?[prior.draft?.context,prior.draft?.actions,prior.draft?.alternative,prior.draft?.remaining,'Prior test evidence type: '+(prior.test_type??'not recorded'),prior.draft?.testEvidence].filter(Boolean).join('\n'):'',
          communication:message?[message.final_message,'Message approval status: '+(message.approval_status??'pending human review')].filter(Boolean).join('\n'):'',
          concerns:message?.draft?.open??''}))
      }
    }).catch(()=>{if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
    return()=>{active=false}
  },[enrollmentId])
  const request=approvedAiRequest.replace('[draft]',JSON.stringify({permission_status:permission,plan:draft},null,2))
  const complete=Object.entries(draft).every(([k,v])=>k==='carryForward'||k==='permissionReference'||v.trim())&&checked&&(permission==='pending_simulated'||!!draft.permissionReference.trim())
  const govern={goal:draft.goal,owners:draft.owners,values:draft.values,evidence:draft.evidence,rules:draft.rules,notice:draft.notice}
  const evidence={lesson:'3.5',draft,govern_view:govern,permission_status:permission,approval_reference:permission==='authorized_reported_by_learner'?draft.permissionReference:null,
    experiment_remains_simulated:permission==='pending_simulated',ai_request:request,learner_review_confirmed:checked,learner_report_is_not_a_permission_grant:true}
  const recordText=JSON.stringify(evidence,null,2)
  function field(k:keyof Draft){return <label key={k}>{fields[k]}<textarea rows={k==='testDesign'||k==='carryForward'?5:3} value={draft[k]} onChange={e=>setDraft(old=>({...old,[k]:e.target.value}))}/></label>}
  async function copy(text:string,message:string){try{await navigator.clipboard.writeText(text);setStatus(message)}catch{setStatus('Clipboard is unavailable. Select the request or record text below to copy it.')}}
  async function save(){
    if(!enrollmentId||!project||!complete||saving)return
    setSaving(true)
    try{
      const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,
        patch:{leadership_and_adoption_plan:{pilot_lesson_3_5:evidence},governance_literacy_evidence:{govern_lesson_3_5:{lesson:'3.5',govern_view:govern,permission_status:permission,source_section:'leadership_and_adoption_plan.pilot_lesson_3_5'}}},
        decisionNote:'Lesson 3.5 — '+draft.decisionNote})
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'. '+(permission==='pending_simulated'?'Approval unresolved; the experiment remains simulated.':'Authorization reported by you with its human reference and scope.'))
    }catch{setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally{setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-pilot-heading">
    <header><p className="eyebrow">Journey Three · Pilot · Evidence · Human Decisions</p><h2 id="p2-pilot-heading">Plan a bounded pilot with accountable decisions</h2>
      <p>Continue the same project. Use fictional or authorized sample material. A plan and a saved record do not grant permission. Missing approval keeps the experiment simulated.</p></header>
    <div><h3>1. Set the scope and actual permission status</h3>{(['context','carryForward','scope','inputs'] as const).map(field)}
      <label>Pilot authorization status<select value={permission} onChange={e=>setPermission(e.target.value as Permission)}><option value="pending_simulated">Approval unresolved — experiment remains simulated</option><option value="authorized_reported_by_learner">Actual human authorization given — record reference and scope</option></select></label>
      {field('permissionReference')}{(['approvalOwner','reviewOwner','correctionOwner','stopOwner','escalation'] as const).map(field)}
      <p>Verify the real roles. Separate approval, monitoring, review, correction, stopping and escalation. Restart belongs to the appropriate human decision under the actual policy.</p></div>
    <div><h3>2. Assemble the Leadership and Adoption Plan</h3>{(['purpose','people','concerns','communication','participation','support','humanControl','feedback','risksLimits','nextReview'] as const).map(field)}
      <p>Carry forward the people map, listening, message and readiness resource. Keep simulations separate from actual feedback. Name the participant task, accessible support and human question route.</p></div>
    <div><h3>3. Check GOVERN and balanced measures</h3>{(['goal','owners','values','evidence','rules','notice','baseline','qualityMeasure','peopleMeasure','stopTrigger','dependencies'] as const).map(field)}
      <p>GOVERN means goal, owners, values, evidence, rules and notice. Check it against the real role and policy context. Compare the whole task including review and correction. An unmeasured baseline stays unmeasured.</p>
      <label>Pilot-plan AI review request<textarea readOnly rows={9} value={request}/></label><button type="button" onClick={()=>void copy(request,'Pilot-plan request copied. Verify suggestions and do not assume authorization.')}>Copy pilot-plan review request</button>{field('aiReview')}
    </div>
    <div><h3>4. Rehearse the decision and retain the design</h3>{(['testDesign','completionExplanation','decisionNote'] as const).map(field)}
      <p>FICTIONAL APPLIED CHECK: The supplied brief permits only approved invented requests. Manager authorizes; coordinator monitors; reviewer corrects and stops for sensitive information; policy owner handles permission concerns. Manual task including review: 8 minutes. Assisted draft: 5 minutes plus 4 minutes review. Identify who approves, stops and corrects, and why speed alone cannot justify expansion. These are invented teaching facts.</p>
      <label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked GOVERN against roles and policy, the whole-task comparison, participant support, stop and correction routes, dependencies and actual permission status.</label></div>
    <div className="p2-workflow-practice-save">{enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save adoption plan and pilot design to My Project Record'}</button>:<p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={()=>void copy(recordText,'Lesson 3.5 adoption plan copied with its actual permission status.')}>Copy my Lesson 3.5 record</button>
      <details><summary>Read or copy my pilot plan</summary><textarea aria-label="Lesson 3.5 pilot record" readOnly rows={12} value={recordText}/></details>
      <p role="status">{status||(complete?'Your adoption plan and pilot test design are ready to save for review.':'Complete the plan, roles, six GOVERN areas, measures, test design and human review check before saving.')}</p>
      <p>Saving preserves earlier adoption-plan and governance work. Use the associated Journey Three workbook section. Carry the plan and dependencies into Lesson 3.6.</p></div>
  </section>
}
