import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "context": "Continuing project, pathway and audience",
  "savedSample": "Saved 4.2 sample, experience outline and boundary",
  "sources": "Approved sources, source labels and missing inputs",
  "voiceBrief": "Intended voice and permitted example passage",
  "aiRole": "Specific AI role, task and limits",
  "originalDraft": "Original generated explanation",
  "keep": "Keep: passages and reasons",
  "remove": "Remove: passages and reasons",
  "verify": "Verify: material claims, sources and unresolved flags",
  "rewrite": "Rewrite: passages and reasons",
  "claimEvidence": "Independent material-claim checks and evidence",
  "permissions": "Source permissions and required attribution",
  "revisedSample": "Revised explanation, usable practice and review standard",
  "realisticExample": "Realistic example and evidence label",
  "purposefulQuestion": "Purposeful reflective question and cycle step",
  "nextAction": "Clear next action within the saved scope",
  "factualCorrection": "One factual correction: before, after and evidence",
  "voiceImprovement": "One voice improvement: before, after and reason",
  "boundaryRevision": "Pressuring or out-of-scope question and its revision",
  "authorityDistinction": "Helpful reflection versus a recommendation requiring qualified authority",
  "audienceCheck": "Clarity, usefulness, access and intended-action check",
  "aiReview": "AI suggestions accepted, corrected or rejected",
  "openAssumptions": "Unresolved claims, permissions and other assumptions",
  "releaseDecision": "Hold or owner-review decision, accountable person and remaining checks",
  "decisionNote": "Human decision note for the continuing Project Record"
} as const
type Draft = Record<keyof typeof fields,string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k,''])) as Draft

export function PhaseTwoContentVoicePractice({enrollmentId,approvedAiRequest}:{enrollmentId?:string;approvedAiRequest:string}) {
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
      const artifact=record.sections.digital_delivery_artifact as {content_voice_lesson_4_3?:{draft?:Partial<Draft>};experience_lesson_4_2?:unknown}|undefined
      const saved=artifact?.content_voice_lesson_4_3
      if(saved?.draft){
        setDraft(Object.fromEntries(Object.keys(fields).map(k=>[k,typeof saved.draft?.[k as keyof Draft]==='string'?saved.draft[k as keyof Draft]:''])) as Draft)
      }else{
        setDraft(old=>({...old,context:record.project_title+' — Path '+record.project_path,
          savedSample:artifact?.experience_lesson_4_2?JSON.stringify(artifact.experience_lesson_4_2,null,2):''}))
      }
    }).catch(()=>{if(active)setStatus('Your Project Record could not load. You can still copy your work.')})
    return()=>{active=false}
  },[enrollmentId])
  const complete=Object.values(draft).every(v=>v.trim())&&checked
  const request=approvedAiRequest.replace('[inputs]',JSON.stringify({context:draft.context,saved_sample_outline_and_boundary:draft.savedSample,approved_sources:draft.sources,voice_brief:draft.voiceBrief,ai_role:draft.aiRole,original_draft:draft.originalDraft,open_assumptions:draft.openAssumptions},null,2))
  const evidence={lesson:'4.3',draft,content_workflow:['direct','generate','examine','revise','verify','release'],review_marks:{keep:draft.keep,remove:draft.remove,verify:draft.verify,rewrite:draft.rewrite},revised_sample:draft.revisedSample,independent_claim_evidence:draft.claimEvidence,source_permissions_and_attribution:draft.permissions,agency:{purposeful_question:draft.purposefulQuestion,scope_revision:draft.boundaryRevision,qualified_authority_distinction:draft.authorityDistinction},applied_check:{factual_correction:draft.factualCorrection,voice_improvement:draft.voiceImprovement},release_decision:draft.releaseDecision,open_assumptions:draft.openAssumptions,ai_request:request,human_review_confirmed:checked,scenario_establishes_audience_usefulness:false,saved_record_grants_publication_permission:false}
  const recordText=JSON.stringify(evidence,null,2)
  function field(k:keyof Draft){return <label key={k}>{fields[k]}<textarea rows={['savedSample','originalDraft','revisedSample','claimEvidence'].includes(k)?5:3} value={draft[k]} onChange={e=>{setDraft(old=>({...old,[k]:e.target.value}));setChecked(false)}}/></label>}
  async function copy(text:string,message:string){try{await navigator.clipboard.writeText(text);setStatus(message)}catch{setStatus('Clipboard is unavailable. Select the displayed request or record to copy it.')}}
  async function save(){
    if(!enrollmentId||!project||!complete||saving)return
    setSaving(true);setStatus('')
    try{
      const result=await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,patch:{digital_delivery_artifact:{content_voice_lesson_4_3:evidence}},decisionNote:'Lesson 4.3 — '+draft.decisionNote})
      setStatus('Saved to your continuing Project Record. Version '+result.saved_version+'. Saving retains the human release decision and does not authorize publication.')
    }catch{setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally{setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-content-voice-practice-title">
    <header><p className="eyebrow">Direct • Generate • Examine • Revise • Verify • Release</p><h2 id="p2-content-voice-practice-title">Create and verify content in your intended voice</h2>
      <p>Continue the same 4.2 sample, audience, outline and service boundary. Use fictional, public or appropriately authorized inputs in your chosen AI assistant.</p></header>
    <div><h3>1. Direct a source-bounded draft</h3>{(['context','savedSample','sources','voiceBrief','aiRole'] as const).map(field)}<p>State missing inputs. Use a specific instructional role, approved sources and a voice brief. Keep the original response for examination.</p>
      <label>Content voice AI request<textarea readOnly rows={10} value={request}/></label><button type="button" onClick={()=>void copy(request,'Content request copied. Independently inspect the response and its verification flags.')}>Copy content AI request</button>{field('originalDraft')}</div>
    <div><h3>2. Examine, revise and verify</h3>{(['keep','remove','verify','rewrite','claimEvidence','permissions','revisedSample'] as const).map(field)}
      <p>Check accuracy, clarity, audience usefulness, voice, realistic examples, supported claims, limits and the intended action. Mark passages with reasons. Another AI agreement is not independent verification. Hold necessary unresolved claims or permissions.</p></div>
    <div><h3>3. Preserve reader choice and complete the sample</h3>{(['realisticExample','purposefulQuestion','nextAction','boundaryRevision','authorityDistinction','audienceCheck','aiReview'] as const).map(field)}
      <p>Teaching needs explanation and usable practice with a review standard. Use Clarify, Explore, Examine, Choose, Act and Review only where a purposeful question helps. Reference the cycle; do not duplicate a general CLEAR worksheet. Coaching-style reflection does not establish authority for diagnosis, therapy or licensed advice.</p></div>
    <div><h3>4. Explain improvements and retain the release decision</h3><p>FICTIONAL APPLIED CHECK: Correct “3 × $40 + $20 = $135” using the supplied invented figures. Remove the unsupported customer-acceptance guarantee. Rewrite “Why are you afraid … will you buy my coaching today?” as a question that preserves choice. Explain one factual correction and one voice improvement. No real price, personal assessment or customer approval is supplied.</p>{(['factualCorrection','voiceImprovement','openAssumptions','releaseDecision','decisionNote'] as const).map(field)}
      <label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I independently checked material claims, source permissions and attribution, revised the voice and question, retained useful practice and scope, and recorded unresolved limits and the accountable human release decision.</label></div>
    <div className="p2-workflow-practice-save">{enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save content and evidence to My Project Record'}</button>:<p>Copy your work to keep it. Saving to My Project Record requires an active enrollment.</p>}
      <button type="button" onClick={()=>void copy(recordText,'Lesson 4.3 revised content, evidence and voice decision copied.')}>Copy my Lesson 4.3 record</button>
      <details><summary>Read or copy my content record</summary><textarea aria-label="Lesson 4.3 content record" readOnly rows={12} value={recordText}/></details>
      <p role="status">{status||(complete?'Your revised sample and evidence are ready to save for review.':'Complete the brief, review decisions, revised sample, claim evidence, voice and agency checks, and human release decision before saving.')}</p>
      <p>Saving preserves earlier project work. Use the connected Journey Four workbook. Carry this same revised sample into Lesson 4.4.</p></div>
  </section>
}
