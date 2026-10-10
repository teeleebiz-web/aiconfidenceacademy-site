import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

type Step = { action: string; owner: string; input: string; decision: string; handoff: string; review: string }
type Friction = { location: string; symptom: string; possibleCause: string; evidenceType: string; sourceToCheck: string; affectedPerson: string }
const newStep=():Step=>({action:'',owner:'',input:'',decision:'',handoff:'',review:''})
const newFriction=():Friction=>({location:'',symptom:'',possibleCause:'',evidenceType:'unverified',sourceToCheck:'',affectedPerson:''})
const approvedPrompt='Organize my verified process notes into people, inputs, steps, decisions, tools, handoffs and review. Flag missing details and possible friction without inventing steps. Notes: '

export function PhaseTwoWorkflowPractice({ enrollmentId }: {enrollmentId?: string}) {
  const [project,setProject]=useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
  const [projectNeed,setProjectNeed]=useState('')
  const [entry,setEntry]=useState('')
  const [completion,setCompletion]=useState('')
  const [people,setPeople]=useState('')
  const [tools,setTools]=useState('')
  const [steps,setSteps]=useState<Step[]>([newStep(),newStep(),newStep(),newStep()])
  const [frictions,setFrictions]=useState<Friction[]>([newFriction(),newFriction(),newFriction()])
  const [verification,setVerification]=useState('')
  const [correctedAi,setCorrectedAi]=useState('')
  const [improvement,setImprovement]=useState('')
  const [improvementOwner,setImprovementOwner]=useState('')
  const [measure,setMeasure]=useState('')
  const [trace,setTrace]=useState('')
  const [noShift,setNoShift]=useState('')
  const [status,setStatus]=useState('')
  const [saving,setSaving]=useState(false)
  useEffect(()=>{
    if(!enrollmentId)return
    let alive=true
    void loadPhaseTwoProject(enrollmentId).then(r=>{
      if(alive&&r)setProject({path:r.project_path,title:r.project_title})
    }).catch(()=>{if(alive)setStatus('Unable to load your existing Project Record. You can still copy your work.')})
    return ()=>{alive=false}
  },[enrollmentId])
  const updateStep=(i:number,key:keyof Step,value:string)=>setSteps(x=>x.map((s,n)=>i===n?{...s,[key]:value}:s))
  const updateFriction=(i:number,key:keyof Friction,value:string)=>setFrictions(x=>x.map((s,n)=>i===n?{...s,[key]:value}:s))
  const complete=!!(projectNeed.trim()&&entry.trim()&&completion.trim()&&people.trim()&&tools.trim()&&
    steps.every(s=>s.action.trim()&&s.owner.trim()&&s.input.trim()&&s.handoff.trim()&&s.review.trim())&&
    frictions.every(f=>f.location.trim()&&f.symptom.trim()&&f.possibleCause.trim()&&f.sourceToCheck.trim()&&f.affectedPerson.trim())&&
    verification.trim()&&improvement.trim()&&improvementOwner.trim()&&measure.trim()&&trace.trim()&&noShift.trim())
  const record={lesson:'2.1',journey:2,continues_journey_one_project:true,
    workflow_view:{project_need:projectNeed,entry_input:entry,reviewed_completion:completion,people,tools,steps},
    three_friction_points:frictions,verification_method:verification,ai_correction:correctedAi,
    chosen_improvement:{action:improvement,human_owner:improvementOwner,measure,full_request_trace:trace,
      addresses_cause_not_transferred_burden:noShift},practice_only_not_permission_to_deploy:true}
  const safeNotes=[`Existing need: ${projectNeed}`,`Entry: ${entry}`,`Completion: ${completion}`,`People: ${people}`,`Current tools: ${tools}`,
    ...steps.map((s,i)=>`Step ${i+1}: ${s.action}; Owner: ${s.owner}; Input: ${s.input}; Decision: ${s.decision}; Handoff: ${s.handoff}; Review: ${s.review}`),
    ...frictions.map((f,i)=>`Friction ${i+1}: ${f.location}; Symptom: ${f.symptom}; Possible cause, not confirmed: ${f.possibleCause}; Evidence status: ${f.evidenceType}`)].join('\n')
  const prompt=approvedPrompt+'\n'+safeNotes
  async function copy(value:string,message:string) {
    try{await navigator.clipboard.writeText(value);setStatus(message)}
    catch{setStatus('Clipboard is unavailable. Select the text shown on the page to copy it.')}
  }
  async function save(){
    if(!enrollmentId||!project||!complete)return
    setSaving(true);setStatus('')
    try{
      const result=await savePhaseTwoProjectUpdate({
        enrollmentId,path:project.path,title:project.title,
        patch:{professional_ai_operating_model:{workflow_view_lesson_2_1:record}},
        decisionNote:'Journey Two Lesson 2.1 — current workflow, three friction points, source review and one improvement'
      })
      setStatus('Saved into your continuing Project Record. Version '+result.saved_version+'.')
    }catch{setStatus('Save was unsuccessful. Your answers remain on this page; retry or copy your record.')}
    finally{setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-workflow-heading">
    <header>
      <p className="eyebrow">Continue Your Project • Map • Verify • Improve</p>
      <h2 id="p2-workflow-heading">Map the actual work and locate three friction points</h2>
      <p>Use the same project you scoped in Journey One. Record the current work, not an imaginary ideal workflow. Use fictional or authorized sanitized process notes with your chosen AI assistant on phone, tablet or computer.</p>
    </header>
    <h3>1. Establish the Workflow View</h3>
    <label>Existing Journey One audience need and FOCUS charter<textarea value={projectNeed} onChange={e=>setProjectNeed(e.target.value)}/></label>
    <label>What request or information starts the work?<textarea value={entry} onChange={e=>setEntry(e.target.value)}/></label>
    <label>What does human-reviewed completion look like?<textarea value={completion} onChange={e=>setCompletion(e.target.value)}/></label>
    <label>Who is involved and who is served?<textarea value={people} onChange={e=>setPeople(e.target.value)}/></label>
    <label>What actual tools or approved sources are used?<textarea value={tools} onChange={e=>setTools(e.target.value)}/></label>
    <h3>2. Record the steps, owners and handoffs</h3>
    <p>Begin with four steps; add more only when your current process requires them. A decision may be “no branch”; an owner and review must not be invented.</p>
    {steps.map((s,i)=><fieldset key={i}>
      <legend>Current step {i+1}</legend>
      <label>Action or task<textarea value={s.action} onChange={e=>updateStep(i,'action',e.target.value)}/></label>
      <label>Human owner<textarea value={s.owner} onChange={e=>updateStep(i,'owner',e.target.value)}/></label>
      <label>Information required<textarea value={s.input} onChange={e=>updateStep(i,'input',e.target.value)}/></label>
      <label>Decision or branch, if any<textarea value={s.decision} onChange={e=>updateStep(i,'decision',e.target.value)}/></label>
      <label>Handoff to next owner or stage<textarea value={s.handoff} onChange={e=>updateStep(i,'handoff',e.target.value)}/></label>
      <label>What is checked and by whom?<textarea value={s.review} onChange={e=>updateStep(i,'review',e.target.value)}/></label>
    </fieldset>)}
    <button type="button" onClick={()=>setSteps(s=>[...s,newStep()])}>Add current workflow step</button>
    {steps.length>4&&<button type="button" onClick={()=>setSteps(s=>s.slice(0,-1))}>Remove last step</button>}
    <h3>3. Identify three evidence-labeled friction points</h3>
    {frictions.map((f,i)=><fieldset key={i}>
      <legend>Friction {i+1}</legend>
      <label>Where does it appear?<textarea value={f.location} onChange={e=>updateFriction(i,'location',e.target.value)}/></label>
      <label>What delay, repetition, omission or rework is visible?<textarea value={f.symptom} onChange={e=>updateFriction(i,'symptom',e.target.value)}/></label>
      <label>Possible cause (a hypothesis until checked)<textarea value={f.possibleCause} onChange={e=>updateFriction(i,'possibleCause',e.target.value)}/></label>
      <label>Evidence status<select value={f.evidenceType} onChange={e=>updateFriction(i,'evidenceType',e.target.value)}>
        <option value="unverified">Not yet verified</option><option value="observed">Observed in authorized process</option>
        <option value="reported">Reported by involved person</option><option value="assumed">Assumed or inferred</option><option value="simulated">Fictional practice scenario</option>
      </select></label>
      <label>What source or respectful question will check it?<textarea value={f.sourceToCheck} onChange={e=>updateFriction(i,'sourceToCheck',e.target.value)}/></label>
      <label>Who is affected, without blaming the worker?<textarea value={f.affectedPerson} onChange={e=>updateFriction(i,'affectedPerson',e.target.value)}/></label>
    </fieldset>)}
    <h3>4. Work with your AI assistant, then verify</h3>
    <p>Copy this request to your chosen AI assistant. Do not share confidential records without permission. Verify its process map against your real authorized notes or mark the example fictional.</p>
    <textarea aria-label="Workflow View AI request" readOnly rows={9} value={prompt}/>
    <button type="button" onClick={()=>void copy(prompt,'Approved workflow organization request copied.')}>Copy Workflow View request</button>
    <label>How did you verify the current-state map?<textarea value={verification} onChange={e=>setVerification(e.target.value)}/></label>
    <label>What AI-generated step or cause did you correct or reject?<textarea value={correctedAi} onChange={e=>setCorrectedAi(e.target.value)}/></label>
    <h3>5. Choose one responsible improvement</h3>
    <label>Which likely cause will you address, and what changes?<textarea value={improvement} onChange={e=>setImprovement(e.target.value)}/></label>
    <label>Who owns and reviews the changed handoff?<textarea value={improvementOwner} onChange={e=>setImprovementOwner(e.target.value)}/></label>
    <label>What useful outcome could you check against a known or missing baseline?<textarea value={measure} onChange={e=>setMeasure(e.target.value)}/></label>
    <label>Trace one complete request from entry through human-reviewed completion<textarea value={trace} onChange={e=>setTrace(e.target.value)} rows={5}/></label>
    <label>Why does your chosen change remove a cause rather than move the burden or automate a late step?<textarea value={noShift} onChange={e=>setNoShift(e.target.value)}/></label>
    <div className="p2-workflow-practice-save">
      {enrollmentId&&project?<button type="button" disabled={!complete||saving} onClick={()=>void save()}>{saving?'Saving…':'Save Workflow View to My Project Record'}</button>
        :<p>Founder preview: copy your work. No enrolled-learner save is simulated.</p>}
      <button type="button" onClick={()=>void copy(JSON.stringify(record,null,2),'Lesson 2.1 Workflow View evidence copied.')}>Copy my Lesson 2.1 record</button>
      <p role="status">{status||(complete?'Your map is ready for review.':'Complete a current workflow, three frictions and one defensible improvement before saving.')}</p>
    </div>
  </section>
}
