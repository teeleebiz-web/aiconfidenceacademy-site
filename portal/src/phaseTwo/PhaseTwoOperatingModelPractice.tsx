import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoOperatingModelPractice.css'

type Scenario = {situation:string; consequence:string; source:string; aiRole:string; reviewer:string; choice:'proceed'|'pause'; weakRule:string; correction:string}
const makeScenario = (choice:'proceed'|'pause'):Scenario => ({situation:'',consequence:'',source:'',aiRole:'',reviewer:'',choice,weakRule:'',correction:''})
const copyableRequest = 'Challenge this operating model with a routine case, an inaccurate response and a high-consequence request. Identify weaknesses and missing human owners. Suggest corrections for my review. Model: '
const fields = [
  ['purpose','Purpose and outcome — person, task and useful result'],
  ['ai_role','Appropriate AI role or no AI'],
  ['human_owner','Human responsibility — reviewer, approver and exception owner'],
  ['review_process','Review process — authorized source, accuracy and suitability checks'],
  ['boundaries','Responsible boundaries — privacy, authority and stop conditions'],
  ['growth','Growth commitments — practice, evidence and revision plan'],
] as const
type FieldKey = typeof fields[number][0]
const empty=Object.fromEntries(fields.map(([key])=>[key,''])) as Record<FieldKey,string>

export function PhaseTwoOperatingModelPractice({ enrollmentId }: { enrollmentId?: string }) {
  const [model,setModel] = useState<Record<FieldKey,string>>({...empty})
  const [scenarios,setScenarios] = useState<Scenario[]>([makeScenario('proceed'),makeScenario('pause'),makeScenario('pause')])
  const [original,setOriginal] = useState('')
  const [revised,setRevised] = useState('')
  const [reason,setReason] = useState('')
  const [proceed,setProceed] = useState('')
  const [pause,setPause] = useState('')
  const [charter,setCharter] = useState('')
  const [direction,setDirection] = useState('')
  const [aiCorrection,setAiCorrection] = useState('')
  const [project,setProject] = useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
  const [status,setStatus] = useState('')
  const [saving,setSaving] = useState(false)
  useEffect(()=>{
    if (!enrollmentId) return
    let alive=true
    void loadPhaseTwoProject(enrollmentId).then(r=>{
      if (alive && r) setProject({path:r.project_path,title:r.project_title})
    }).catch(()=>{if(alive)setStatus('Project Record not available; copy your answers for safekeeping.')})
    return ()=>{alive=false}
  },[enrollmentId])
  const updateScenario=(index:number,key:keyof Scenario,value:string)=>{
    setScenarios(a=>a.map((s,i)=>i===index?{...s,[key]:value}:s))
  }
  const prompt=copyableRequest+'\n'+fields.map(([key,label])=>label+': '+model[key]).join('\n')
  const complete=fields.every(([key])=>model[key].trim())&&
    scenarios.every(s=>s.situation.trim()&&s.consequence.trim()&&s.source.trim()&&s.aiRole.trim()&&s.reviewer.trim()&&s.weakRule.trim()&&s.correction.trim())&&
    [original,revised,reason,proceed,pause,charter,direction].every(x=>x.trim())&&
    scenarios.some(s=>s.choice==='proceed')&&scenarios.some(s=>s.choice==='pause')
  const record={
    lesson:'1.6',journey:1,working_model_not_technical_architecture:true,
    original_six_part_model:model,
    scenarios:scenarios.map((s,i)=>({...s,type:['routine','inaccurate_output','high_consequence_privacy_or_authority'][i]})),
    original_rule:original,revised_or_justified_rule:revised,reason_for_change:reason,
    proceed_rationale:proceed,pause_rationale:pause,confirmed_focus_charter:charter,
    project_direction:direction,ai_suggestion_review:aiCorrection,
    simulated_scenarios_not_real_approval:true,
  }
  const copy=async(value:string,message:string)=>{
    try{await navigator.clipboard.writeText(value);setStatus(message)}
    catch{setStatus('Copy unavailable. Select the visible text instead.')}
  }
  async function save(){
    if(!enrollmentId||!project||!complete)return
    setSaving(true);setStatus('')
    try{
      const r=await savePhaseTwoProjectUpdate({
        enrollmentId,path:project.path,title:project.title,
        patch:{professional_ai_operating_model:{journey_one_final_lesson_1_6:record}},
        decisionNote:'Journey One final model — three stress tests, revised rule, proceed/pause and FOCUS capstone'
      })
      setStatus('Saved in the continuing Project Record. Version '+r.saved_version+'.')
    }catch{setStatus('Your work did not save. Keep the page open, retry or copy your answers.')}
    finally{setSaving(false)}
  }
  return <section className="p2-operating-model-practice" aria-labelledby="p2-model-practice-heading">
    <header>
      <p className="eyebrow">Journey One · Final Applied Review</p>
      <h2 id="p2-model-practice-heading">Stress test your Professional AI Operating Model</h2>
      <p>Use the same project and FOCUS charter from Lessons 1.1–1.5. This model governs responsible professional work, not a technical architecture or permission to deploy AI.</p>
    </header>
    <h3>1. Assemble the six-part operating model</h3>
    {fields.map(([key,label])=><label key={key}>{label}
      <textarea value={model[key]} onChange={e=>setModel(v=>({...v,[key]:e.target.value}))}/>
    </label>)}
    <h3>2. Review three different scenarios</h3>
    <p>Use fictional or otherwise approved sanitized examples. Never paste real sensitive records into an AI assistant for this test.</p>
    {scenarios.map((s,i)=><fieldset key={i}>
      <legend>{['Routine task','Inaccurate AI output','High-consequence privacy or authority request'][i]}</legend>
      <label>Scenario and fictional/safe input<textarea value={s.situation} onChange={e=>updateScenario(i,'situation',e.target.value)}/></label>
      <label>What is the consequence of an error?<textarea value={s.consequence} onChange={e=>updateScenario(i,'consequence',e.target.value)}/></label>
      <label>Which approved source should be checked?<textarea value={s.source} onChange={e=>updateScenario(i,'source',e.target.value)}/></label>
      <label>What limited AI role or no-AI rule applies?<textarea value={s.aiRole} onChange={e=>updateScenario(i,'aiRole',e.target.value)}/></label>
      <label>Named human reviewer or approver<textarea value={s.reviewer} onChange={e=>updateScenario(i,'reviewer',e.target.value)}/></label>
      <label>Proceed or pause?<select value={s.choice} onChange={e=>updateScenario(i,'choice',e.target.value)}>
        <option value="proceed">Proceed with authorized review</option><option value="pause">Pause and escalate</option>
      </select></label>
      <label>What rule is weak or insufficient?<textarea value={s.weakRule} onChange={e=>updateScenario(i,'weakRule',e.target.value)}/></label>
      <label>How would you correct or justify it?<textarea value={s.correction} onChange={e=>updateScenario(i,'correction',e.target.value)}/></label>
    </fieldset>)}
    <h3>3. Challenge the model using your own AI assistant</h3>
    <p>Copy the prompt and use the AI assistant of your choice on a phone, tablet or computer. Bring back its suggestions, but accept only corrections supported by your actual authorized sources and human judgment.</p>
    <textarea aria-label="Operating Model AI challenge prompt" readOnly rows={8} value={prompt}/>
    <button type="button" onClick={()=>void copy(prompt,'Operating Model challenge prompt copied.')}>Copy the AI challenge</button>
    <label>What AI suggestion required correction or rejection?<textarea value={aiCorrection} onChange={e=>setAiCorrection(e.target.value)}/></label>
    <h3>4. Revise a rule and defend two decisions</h3>
    <label>Original review or boundary rule<textarea value={original} onChange={e=>setOriginal(e.target.value)}/></label>
    <label>Revised or evidence-justified rule<textarea value={revised} onChange={e=>setRevised(e.target.value)}/></label>
    <label>Explain why this revision matters, or why the existing rule holds<textarea value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <label>Defend one PROCEED decision with approved inputs and named human review<textarea value={proceed} onChange={e=>setProceed(e.target.value)}/></label>
    <label>Defend one PAUSE decision with the missing authority or evidence and escalation owner<textarea value={pause} onChange={e=>setPause(e.target.value)}/></label>
    <h3>5. Confirm Journey One's project direction</h3>
    <label>Your feasible FOCUS charter and one realistic first test<textarea value={charter} onChange={e=>setCharter(e.target.value)} rows={5}/></label>
    <label>Confirmed project direction and one permission or risk still unresolved<textarea value={direction} onChange={e=>setDirection(e.target.value)}/></label>
    <div className="p2-operating-model-actions">
      {enrollmentId&&project?<button type="button" onClick={()=>void save()} disabled={!complete||saving}>{saving?'Saving…':'Save Journey One Operating Model'}</button>
        :<p>Founder preview: copy your evidence; no learner save or journey completion is simulated.</p>}
      <button type="button" onClick={()=>void copy(JSON.stringify(record,null,2),'Journey One operating model evidence copied.')}>Copy my Journey One evidence</button>
      <p role="status">{status||(complete?'Ready for human review; saving does not award completion or open Journey Two.':'Complete the six parts, three scenarios, revised rule and defend proceed/pause decisions.')}</p>
    </div>
  </section>
}
