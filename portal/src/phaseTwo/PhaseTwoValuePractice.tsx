import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoValuePractice.css'

type Task = { task: string; role: string; humanDecision: string; benefit: string; reviewEffort: string; unknown: string }
const roles = ['Organizer','Question generator','Comparison partner','Draft assistant','Editor','Rehearsal partner','No AI']
const makeTask = (): Task => ({task:'',role:'No AI',humanDecision:'',benefit:'',reviewEffort:'',unknown:''})
const approvedRequest = 'Compare these five tasks by suitable AI support, human decision, likely benefit, added review effort and uncertainty. Include a no-AI option. Do not guarantee savings. Separate supplied facts from assumptions. Tasks: '

export function PhaseTwoValuePractice({ enrollmentId }: { enrollmentId?: string }) {
  const [tasks,setTasks] = useState<Task[]>(Array.from({length:5},makeTask))
  const [baseline,setBaseline] = useState('')
  const [baselineQuality,setBaselineQuality] = useState('unknown')
  const [aiOption,setAiOption] = useState('')
  const [simpleOption,setSimpleOption] = useState('')
  const [measure,setMeasure] = useState('')
  const [reviewOwner,setReviewOwner] = useState('')
  const [narrowRole,setNarrowRole] = useState('')
  const [hypothesis,setHypothesis] = useState('')
  const [reversal,setReversal] = useState('')
  const [correction,setCorrection] = useState('')
  const [project,setProject] = useState<{path:PhaseTwoProjectPath;title:string}|null>(null)
  const [status,setStatus] = useState('')
  const [saving,setSaving] = useState(false)

  useEffect(()=>{
    if(!enrollmentId) return
    let alive=true
    void loadPhaseTwoProject(enrollmentId).then(r=>{
      if(alive&&r)setProject({path:r.project_path,title:r.project_title})
    }).catch(()=>{if(alive)setStatus('The Project Record could not load. You can still copy your work.')})
    return ()=>{alive=false}
  },[enrollmentId])

  const update=(index:number,field:keyof Task,value:string)=>setTasks(old=>old.map((t,i)=>i===index?{...t,[field]:value}:t))
  const complete=tasks.every(t=>t.task.trim()&&t.humanDecision.trim()&&t.benefit.trim()&&t.reviewEffort.trim()&&t.unknown.trim())
    &&baseline.trim()&&aiOption.trim()&&simpleOption.trim()&&measure.trim()&&reviewOwner.trim()
    &&narrowRole.trim()&&hypothesis.trim()&&reversal.trim()
  const record={lesson:'1.3',five_task_role_table:tasks,value_hypothesis:{
    baseline,baseline_status:baselineQuality,ai_approach:aiOption,non_ai_approach:simpleOption,
    business_value_measure:measure,human_review_owner:reviewOwner,narrow_or_no_ai_case:narrowRole,
    proposed_hypothesis:hypothesis,reconsideration_evidence:reversal,ai_output_review:correction
  }}
  const prompt=approvedRequest+'\n'+tasks.map((t,i)=>`${i+1}. ${t.task||'(task to define)'}`).join('\n')
  const copy=async(text:string,message:string)=>{
    try{await navigator.clipboard.writeText(text);setStatus(message)}
    catch{setStatus('Copy was unavailable. You can select the displayed text instead.')}
  }
  async function save(){
    if(!enrollmentId||!project||!complete)return
    setSaving(true);setStatus('')
    try{
      const result=await savePhaseTwoProjectUpdate({
        enrollmentId,path:project.path,title:project.title,
        patch:{professional_ai_operating_model:{ai_roles_and_value_lesson_1_3:record}},
        decisionNote:'Lesson 1.3 — five AI roles, non-AI comparison and measurable value hypothesis'
      })
      setStatus('Saved in your continuing Project Record. Version '+result.saved_version+'.')
    }catch{setStatus('Your work did not save. Keep this page open or copy your record and try again.')}
    finally{setSaving(false)}
  }
  return <section className="p2-value-practice" aria-labelledby="p2-value-practice-heading">
    <header>
      <p className="eyebrow">Use AI • Compare • Verify • Save</p>
      <h2 id="p2-value-practice-heading">Assign AI roles and test real business value</h2>
      <p>Continue the need selected in Lesson 1.2. Use only fictional or sanitized notes in your chosen AI assistant on your phone, tablet or computer. Record what remains human.</p>
    </header>
    <h3>1. Match five tasks to their proper roles</h3>
    {tasks.map((t,i)=><fieldset key={i}>
      <legend>Task {i+1}</legend>
      <label>Work to be done<textarea value={t.task} onChange={e=>update(i,'task',e.target.value)}/></label>
      <label>Role for AI (or no AI)<select value={t.role} onChange={e=>update(i,'role',e.target.value)}>
        {roles.map(r=><option key={r}>{r}</option>)}
      </select></label>
      <label>Human judgment or approval<textarea value={t.humanDecision} onChange={e=>update(i,'humanDecision',e.target.value)}/></label>
      <label>Likely benefit for a person<textarea value={t.benefit} onChange={e=>update(i,'benefit',e.target.value)}/></label>
      <label>Added review, correction or transferred effort<textarea value={t.reviewEffort} onChange={e=>update(i,'reviewEffort',e.target.value)}/></label>
      <label>What is still unknown?<textarea value={t.unknown} onChange={e=>update(i,'unknown',e.target.value)}/></label>
    </fieldset>)}
    <h3>2. Use and challenge your own AI assistant</h3>
    <p>Copy this request to your chosen AI. It must compare AI and no-AI options. Reject unsupported promises or hidden review costs.</p>
    <textarea aria-label="AI roles request" readOnly rows={7} value={prompt}/>
    <button type="button" onClick={()=>void copy(prompt,'AI comparison request copied. Review its answers before using them.')}>Copy AI comparison request</button>
    <label>What did you challenge or correct in the AI response?<textarea value={correction} onChange={e=>setCorrection(e.target.value)}/></label>
    <h3>3. Compare the entire job</h3>
    <p>In the fictional proposal example, 20 minutes less drafting plus 30 extra minutes of corrections means the full job took 10 minutes longer. Measure the full process, not output speed alone.</p>
    <label>Current process and baseline<textarea value={baseline} onChange={e=>setBaseline(e.target.value)}/></label>
    <label>Quality of the baseline<select value={baselineQuality} onChange={e=>setBaselineQuality(e.target.value)}>
      <option value="unknown">Not yet established</option><option value="estimated">Estimated</option><option value="measured">Measured from authorized evidence</option><option value="fictional">Fictional practice</option>
    </select></label>
    <label>Proposed AI-supported method<textarea value={aiOption} onChange={e=>setAiOption(e.target.value)}/></label>
    <label>Simpler non-AI method<textarea value={simpleOption} onChange={e=>setSimpleOption(e.target.value)}/></label>
    <label>What useful result will you measure, including review effort?<textarea value={measure} onChange={e=>setMeasure(e.target.value)}/></label>
    <label>Who will verify and approve the outcome?<textarea value={reviewOwner} onChange={e=>setReviewOwner(e.target.value)}/></label>
    <h3>4. Make a provisional value decision</h3>
    <label>Which task deserves narrow AI support or no AI, and why?<textarea value={narrowRole} onChange={e=>setNarrowRole(e.target.value)}/></label>
    <label>State the value hypothesis without promising savings<textarea value={hypothesis} onChange={e=>setHypothesis(e.target.value)}/></label>
    <label>What evidence would change your conclusion?<textarea value={reversal} onChange={e=>setReversal(e.target.value)}/></label>
    <div className="p2-value-actions">
      {enrollmentId&&project?<button type="button" onClick={()=>void save()} disabled={!complete||saving}>{saving?'Saving…':'Save to My Project Record'}</button>
        :<p>Founder preview: copy your work. No false learner save is shown.</p>}
      <button type="button" onClick={()=>void copy(JSON.stringify(record,null,2),'Lesson 1.3 project evidence copied.')}>Copy my Lesson 1.3 work</button>
      <p role="status">{status||(complete?'Your value hypothesis is ready for review.':'Complete the five tasks and value comparison before saving.')}</p>
    </div>
  </section>
}
