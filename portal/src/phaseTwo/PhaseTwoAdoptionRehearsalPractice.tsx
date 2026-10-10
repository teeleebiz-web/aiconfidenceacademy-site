import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'
const fields = {
  "context": "Continuing project and bounded scope",
  "peopleMap": "People map and the person with least authority",
  "listeningEvidence": "Listening evidence — actual, simulated and unknown",
  "earlierMessage": "Earlier change message and its approval status",
  "earlierSupport": "Earlier readiness support and its evidence status",
  "pilotDesign": "Earlier pilot design, measures, human roles and permission limits",
  "worker": "Worker perspective — task, burden, access and questions",
  "recipient": "Recipient perspective — useful result and concerns",
  "reviewer": "Reviewer perspective — evidence, effort and accountable review",
  "leastAuthority": "Least-authority perspective — practical support and human question route",
  "problem": "Access or accountability problem introduced in the rehearsal",
  "unresolvedConcern": "Unresolved concern and what evidence is missing",
  "simulatedReactions": "Simulated reactions — label source and perspective",
  "humanFeedback": "Authorized human feedback — meaning, context and limits, if available",
  "justification": "My decision justification before asking AI for revisions",
  "aiReview": "AI revisions considered, verified and rejected",
  "beforeRevision": "Earlier condition that needs a material change",
  "afterRevision": "Revised condition and expected practical effect",
  "revisionEvidence": "Evidence behind the material revision and its limits",
  "finalPlan": "Final retained Leadership and Adoption Plan",
  "finalCommunication": "Revised communication and its actual approval status",
  "finalResource": "Revised practical training resource and its honest test status",
  "questionRoute": "Participant question route and named human recipient",
  "support": "Practical support participants can actually use",
  "accountableOwner": "Named human accountable for the adoption decision",
  "permissionReference": "Actual human approval reference and scope, if granted",
  "accessEvidence": "Evidence of approved participant access, or unresolved dependency",
  "dependencies": "Open dependencies and the condition for human reconsideration",
  "nextReview": "Next review date or event and named human owner",
  "decisionNote": "Revision rationale — the most important change and why",
  "completionExplanation": "Applied check — defend the decision and show questions, support and ownership"
} as const
type Draft = Record<keyof typeof fields,string>
type Decision = '' | 'proceed_with_permission' | 'limited_test' | 'revise' | 'pause'
type Feedback = 'simulated' | 'human' | 'mixed'
type Permission = 'pending_simulated' | 'authorized_reported_by_learner'
type Access = 'unresolved' | 'verified_reported_by_learner'
type Blockers = 'open' | 'resolved_reported_by_learner'
const blank = () => Object.fromEntries(Object.keys(fields).map(k=>[k,''])) as Draft
const obj = (value:unknown):Record<string,unknown> => value && typeof value==='object' ? value as Record<string,unknown> : {}
const txt = (value:unknown) => typeof value==='string' ? value : ''
const retained = (value:unknown) => value && Object.keys(obj(value)).length ? JSON.stringify(value,null,2) : ''
export function PhaseTwoAdoptionRehearsalPractice({enrollmentId,approvedAiRequest}:{enrollmentId?:string;approvedAiRequest:string}) {
 const [draft,setDraft]=useState<Draft>(blank)
 const [decision,setDecision]=useState<Decision>('')
 const [feedback,setFeedback]=useState<Feedback>('simulated')
 const [permission,setPermission]=useState<Permission>('pending_simulated')
 const [access,setAccess]=useState<Access>('unresolved')
 const [blockers,setBlockers]=useState<Blockers>('open')
 const [justified,setJustified]=useState(false)
 const [checked,setChecked]=useState(false)
 const [project,setProject]=useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
 const [status,setStatus]=useState('')
 const [saving,setSaving]=useState(false)
 useEffect(()=>{
  setDraft(blank());setDecision('');setFeedback('simulated');setPermission('pending_simulated');setAccess('unresolved');setBlockers('open');setJustified(false);setChecked(false);setProject(null);setStatus('')
  if(!enrollmentId)return
  let active=true
  void loadPhaseTwoProject(enrollmentId).then(record=>{
   if(!active||!record)return
   setProject({path:record.project_path,title:record.project_title})
   const plan=obj(record.sections.leadership_and_adoption_plan)
   const saved=obj(plan.adoption_rehearsal_lesson_3_6)
   if(saved.draft){
    const d=obj(saved.draft);setDraft(Object.fromEntries(Object.keys(fields).map(k=>[k,txt(d[k])])) as Draft)
    setDecision(['proceed_with_permission','limited_test','revise','pause'].includes(txt(saved.decision))?saved.decision as Decision:'')
    setFeedback(saved.feedback_type==='human'?'human':saved.feedback_type==='mixed'?'mixed':'simulated')
    setPermission(saved.permission_status==='authorized_reported_by_learner'?'authorized_reported_by_learner':'pending_simulated')
    setAccess(saved.access_status==='verified_reported_by_learner'?'verified_reported_by_learner':'unresolved')
    setBlockers(saved.blocker_status==='resolved_reported_by_learner'?'resolved_reported_by_learner':'open')
   }else{
    const pilot=obj(plan.pilot_lesson_3_5),pd=obj(pilot.draft),message=obj(plan.change_message_lesson_3_3),readiness=obj(plan.readiness_lesson_3_4)
    const communication=[txt(message.final_message),'Message approval status: '+(txt(message.approval_status)||'not recorded')].filter(Boolean).join('\n')
    const support=retained(readiness)
    setDraft(old=>({...old,context:record.project_title,peopleMap:retained(plan.people_lesson_3_1),listeningEvidence:retained(plan.listening_lesson_3_2),earlierMessage:communication,earlierSupport:support,pilotDesign:retained(pilot),finalPlan:retained(pd),finalCommunication:communication,finalResource:support,dependencies:txt(pd.dependencies)}))
   }
  }).catch(()=>{if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
  return()=>{active=false}
 },[enrollmentId])
 const request=approvedAiRequest.replace('[draft]',JSON.stringify({plan:draft.pilotDesign,people_map:draft.peopleMap,listening_evidence:draft.listeningEvidence,message:draft.earlierMessage,support:draft.earlierSupport,permission_status:permission},null,2))
 const asksRealTest=decision==='proceed_with_permission'||decision==='limited_test'
 const actualConditions=permission==='authorized_reported_by_learner'&&!!draft.permissionReference.trim()&&access==='verified_reported_by_learner'&&blockers==='resolved_reported_by_learner'
 const complete=Object.entries(draft).every(([k,v])=>k==='humanFeedback'||k==='permissionReference'||v.trim())&&!!decision&&justified&&checked&&(feedback==='simulated'||!!draft.humanFeedback.trim())&&(permission==='pending_simulated'||!!draft.permissionReference.trim())&&(!asksRealTest||actualConditions)
 const evidence={lesson:'3.6',draft,decision,feedback_type:feedback,permission_status:permission,access_status:access,blocker_status:blockers,approval_reference:permission==='authorized_reported_by_learner'?draft.permissionReference:null,
  final_leadership_and_adoption_plan:draft.finalPlan,final_communication:draft.finalCommunication,final_training_resource:draft.finalResource,revision_rationale:draft.decisionNote,next_review:draft.nextReview,
  ai_request:request,justification_before_revisions_confirmed:justified,human_review_confirmed:checked,simulated_reactions_establish_acceptance:false,record_grants_permission:false,real_test_conditions_reported_by_learner:actualConditions}
 const recordText=JSON.stringify(evidence,null,2)
 function field(k:keyof Draft){return <label key={k}>{fields[k]}<textarea rows={k.startsWith('final')?6:3} value={draft[k]} onChange={e=>{setDraft(old=>({...old,[k]:e.target.value}));setChecked(false);if(k==='justification')setJustified(false)}}/></label>}
 async function copy(text:string,message:string){try{await navigator.clipboard.writeText(text);setStatus(message)}catch{setStatus('Clipboard is unavailable. Select the request or record text below to copy it.')}}
 async function save(){
  if(!enrollmentId||!project||!complete||saving)return
  setSaving(true)
  try{const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,patch:{leadership_and_adoption_plan:{adoption_rehearsal_lesson_3_6:evidence}},decisionNote:'Lesson 3.6 — '+draft.decisionNote});setStatus('Saved final plan, communication and training resource to your continuing Project Record. Version '+result.saved_version+'. Simulated reactions do not establish actual acceptance; this record grants no permission.')}
  catch{setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
  finally{setSaving(false)}
 }
 return <section className="p2-workflow-practice" aria-labelledby="p2-adoption-rehearsal-heading">
  <header><p className="eyebrow">Journey Three · Rehearse · Revise · Retain</p><h2 id="p2-adoption-rehearsal-heading">Rehearse adoption and revise the plan</h2><p>Continue the same project. A rehearsal tests your reasoning; simulated reactions do not prove actual staff acceptance. Retain human feedback only when available and authorized.</p></header>
  <div><h3>1. Connect the five artifacts</h3>{(['context','peopleMap','listeningEvidence','earlierMessage','earlierSupport','pilotDesign'] as const).map(field)}<p>Keep actual, simulated and unknown evidence distinct. Earlier approval status and dependencies stay visible.</p></div>
  <div><h3>2. Challenge the plan from three perspectives</h3>{(['worker','recipient','reviewer','leastAuthority','problem','unresolvedConcern'] as const).map(field)}
   <label>Feedback source<select value={feedback} onChange={e=>setFeedback(e.target.value as Feedback)}><option value="simulated">Simulated reactions — no actual acceptance established</option><option value="human">Authorized human feedback — retain context and limits</option><option value="mixed">Mixed — label human feedback and simulated reactions separately</option></select></label>{field('simulatedReactions')}{field('humanFeedback')}
   <label>Adoption-plan AI challenge request<textarea readOnly rows={9} value={request}/></label><button type="button" onClick={()=>void copy(request,'Adoption challenge copied. Justify your decision before requesting revisions.')}>Copy adoption-plan challenge request</button></div>
  <div><h3>3. Justify the decision before requesting revisions</h3><label>Adoption decision<select value={decision} onChange={e=>{setDecision(e.target.value as Decision);setJustified(false);setChecked(false)}}><option value="">Choose an evidence-based decision</option><option value="proceed_with_permission">Proceed with permission</option><option value="limited_test">Limited test within actual permission</option><option value="revise">Revise before a test</option><option value="pause">Pause the affected pilot</option></select></label>{field('justification')}
   <label><input type="checkbox" checked={justified} disabled={!decision||!draft.justification.trim()} onChange={e=>setJustified(e.target.checked)}/>I recorded my decision and evidence before requesting AI revisions.</label>
   {!justified?<p>Read the challenge and write your own decision justification before opening the revision step.</p>:<div><h3>4. Make a material revision and retain the final work</h3>{(['aiReview','beforeRevision','afterRevision','revisionEvidence','finalPlan','finalCommunication','finalResource','questionRoute','support','accountableOwner','permissionReference','accessEvidence','dependencies','nextReview','decisionNote','completionExplanation'] as const).map(field)}
    <label>Pilot authorization status<select value={permission} onChange={e=>setPermission(e.target.value as Permission)}><option value="pending_simulated">Approval unresolved — real pilot remains unapproved</option><option value="authorized_reported_by_learner">Actual human authorization reported — retain reference and scope</option></select></label>
    <label>Approved participant access<select value={access} onChange={e=>setAccess(e.target.value as Access)}><option value="unresolved">Access unresolved or not verified</option><option value="verified_reported_by_learner">Approved access verified and reported by me</option></select></label>
    <label>Blocking conditions<select value={blockers} onChange={e=>setBlockers(e.target.value as Blockers)}><option value="open">Blocking conditions remain open</option><option value="resolved_reported_by_learner">Blocking conditions verified resolved and reported by me</option></select></label>
    <p>Missing approved access must be fixed through the proper human route or the affected pilot paused. Do not share accounts. Proceed or a real limited test requires actual permission, approved access and resolved blocking conditions.</p>
    <p>FICTIONAL APPLIED CHECK: The prototype is accurate, but participants lack approved access. Worker fears appearing resistant; recipient needs a useful timely result; reviewer needs accountable checks. Manager owns the pilot decision, coordinator receives questions, policy owner handles access, reviewer retains review and stop duties. Defend the pause and show a material revision. These reactions are simulated.</p>
    <label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked evidence labels, material revision, permission and access limits, participant question route, practical support, accountable owner and next review.</label></div>}
  </div>
  <div className="p2-workflow-practice-save">{enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save final plan, communication and training resource to My Project Record'}</button>:<p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
   <button type="button" onClick={()=>void copy(recordText,'Lesson 3.6 adoption record copied with evidence and permission limits.')}>Copy my Lesson 3.6 record</button><details><summary>Read or copy my final adoption record</summary><textarea aria-label="Lesson 3.6 adoption record" readOnly rows={12} value={recordText}/></details>
   <p role="status">{status||(complete?'Your final journey version is ready to save for review.':asksRealTest&&!actualConditions?'A real test needs reported human authorization, approved participant access and resolved blocking conditions. Revise or pause while these remain open.':'Complete the perspectives, decision justification, material revision, retained artifacts and human review check before saving.')}</p>
   <p>Saving preserves earlier Journey Three evidence. Use the associated workbook section and carry this same project into Journey Four when released.</p>
  </div>
 </section>
}
