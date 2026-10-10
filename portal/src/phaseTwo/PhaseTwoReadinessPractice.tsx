import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "context": "Continuing project and one bounded task",
  "carryForward": "Change-message carry-forward and unresolved support from Lesson 3.3",
  "audience": "Audience needs — time, access, language, formats, examples and contact",
  "policy": "Approved or supplied fictional policy — permitted inputs, exclusions and human review",
  "actions": "One action per gap — owner, commitment status and observable check",
  "orient": "Orient — task and destination",
  "connect": "Connect — existing skill and evidenced barrier",
  "explain": "Explain — usable rule and stop route",
  "show": "Show — worked example and human correction",
  "practice": "Practice — new participant task",
  "review": "Review — criterion and correction route",
  "apply": "Apply — same project and actual permissions",
  "continue": "Continue — next practice and unresolved question",
  "alternative": "Accessible alternative — same action and review criterion",
  "aiReview": "AI suggestion accepted, revised or rejected and missing support",
  "testEvidence": "Actual test result — evidence type, error, revision and limits",
  "barrierLink": "Applied check — how one support action addresses an evidenced barrier",
  "observableAction": "Applied check — observable readiness action beyond attendance",
  "remaining": "Remaining permission and support dependencies",
  "decisionNote": "Most important readiness correction and why it matters"
} as const
type Draft = Record<keyof typeof fields, string>
const areas = ['purpose', 'people', 'process', 'support', 'responsibility'] as const
type Area = typeof areas[number]
type Judgment = 'strong' | 'developing' | 'unclear'
type View = Record<Area, { judgment: Judgment; evidence: string; gap: string }>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft
const emptyView = () => Object.fromEntries(areas.map(k => [k, { judgment: 'unclear', evidence: '', gap: '' }])) as View

export function PhaseTwoReadinessPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
  const [draft, setDraft] = useState<Draft>(blank)
  const [view, setView] = useState<View>(emptyView)
  const [testType, setTestType] = useState('self_test')
  const [checked, setChecked] = useState(false)
  const [project, setProject] = useState<{path: PhaseTwoProjectPath; title: string} | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setDraft(blank()); setView(emptyView()); setChecked(false); setProject(null); setStatus(''); setTestType('self_test')
    if (!enrollmentId) return
    let active = true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active || !record) return
      setProject({path: record.project_path, title: record.project_title})
      const plan = record.sections.leadership_and_adoption_plan as {
        readiness_lesson_3_4?: {draft?: Partial<Draft>; readiness_view?: Partial<View>; test_type?: string};
        change_message_lesson_3_3?: {final_message?: string; selected_audience_adaptation?: string; approval_status?: string; draft?: {open?: string; responsible?: string}}
      } | undefined
      const saved = plan?.readiness_lesson_3_4
      if (saved?.draft) {
        setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved.draft?.[k as keyof Draft] === 'string' ? saved.draft[k as keyof Draft] : ''])) as Draft)
        setView(Object.fromEntries(areas.map(k => {
          const prior = saved.readiness_view?.[k]
          return [k, {judgment: prior && ['strong','developing','unclear'].includes(prior.judgment) ? prior.judgment : 'unclear', evidence: typeof prior?.evidence === 'string' ? prior.evidence : '', gap: typeof prior?.gap === 'string' ? prior.gap : ''}]
        })) as View)
        setTestType(['self_test','simulation','authorized_participant_test'].includes(saved.test_type ?? '') ? saved.test_type! : 'self_test')
      } else {
        const prior = plan?.change_message_lesson_3_3
        setDraft(old => ({...old, context: record.project_title,
          carryForward: prior ? [prior.final_message, prior.selected_audience_adaptation, 'Approval status: ' + (prior.approval_status ?? 'pending human review'), prior.draft?.open, prior.draft?.responsible].filter(Boolean).join('\n') : ''}))
      }
    }).catch(() => { if (active) setStatus('Your Project Record could not load. You can still copy your work.') })
    return () => {active = false}
  }, [enrollmentId])
  const brief = ['Task: ' + draft.context, 'Audience needs: ' + draft.audience, 'Policy and boundary: ' + draft.policy, 'Support actions: ' + draft.actions, 'Review criterion: ' + draft.review, 'Accessible alternative: ' + draft.alternative].join('\n')
  const request = approvedAiRequest.replace('[brief]', brief)
  const complete = Object.entries(draft).every(([k,v]) => k === 'carryForward' || v.trim()) && areas.every(k => view[k].evidence.trim() && view[k].gap.trim()) && checked
  const evidence = {lesson: '3.4', draft, readiness_view: view, test_type: testType, ai_request: request, learner_review_confirmed: checked, practice_only_not_pilot_authorization: true}
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={k === 'show' || k === 'alternative' ? 5 : 3} value={draft[k]} onChange={e => setDraft(old => ({...old,[k]:e.target.value}))} /></label>
  }
  async function copy(text: string, message: string) {
    try {await navigator.clipboard.writeText(text); setStatus(message)}
    catch {setStatus('Clipboard is unavailable. Select the request or record text below to copy it.')}
  }
  async function save() {
    if (!enrollmentId || !project || !complete || saving) return
    setSaving(true)
    try {
      const result = await savePhaseTwoProjectUpdate({enrollmentId,path:project.path,title:project.title,
        patch:{leadership_and_adoption_plan:{readiness_lesson_3_4:evidence}},decisionNote:'Lesson 3.4 — ' + draft.decisionNote})
      setStatus('Saved to your continuing Project Record. Version ' + result.saved_version + '. Pending permission remains pending.')
    } catch {setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.')}
    finally {setSaving(false)}
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-readiness-heading">
    <header><p className="eyebrow">Journey Three · Readiness · Support · Participation</p><h2 id="p2-readiness-heading">Build readiness support for one task</h2>
      <p>Continue the same project. Use fictional or authorized, sanitized material. A practice resource and a saved plan do not authorize a real pilot.</p></header>
    <div><h3>1. Assess five areas with evidence</h3>{(['context','carryForward','audience','policy'] as const).map(field)}
      <p>Mark each area strong, developing or unclear for this task. Record evidence and limits. For no evidenced gap, say so; for an unclear area, name the missing evidence. Do not invent a universal score.</p>
      {areas.map(area => <fieldset key={area}><legend>{area.charAt(0).toUpperCase()+area.slice(1)}</legend>
        <label>{area} — readiness judgment<select value={view[area].judgment} onChange={e => setView(old => ({...old,[area]:{...old[area],judgment:e.target.value as Judgment}}))}><option value="unclear">Unclear</option><option value="developing">Developing</option><option value="strong">Strong</option></select></label>
        <label>{area} — evidence and limits<textarea rows={3} value={view[area].evidence} onChange={e => setView(old => ({...old,[area]:{...old[area],evidence:e.target.value}}))} /></label>
        <label>{area} — gap or no evidenced gap<textarea rows={3} value={view[area].gap} onChange={e => setView(old => ({...old,[area]:{...old[area],gap:e.target.value}}))} /></label>
      </fieldset>)}{field('actions')}
      <p>Assign one action to each gap with a proposed or agreed owner and observable check. Include the human question route. Confirm support commitments before promising them.</p></div>
    <div><h3>2. Create the short practice resource</h3><label>Practice-resource AI request<textarea readOnly rows={9} value={request} /></label>
      <button type="button" onClick={() => void copy(request,'Practice-resource request copied. Verify policy and missing support.')}>Copy practice-resource request</button>
      {(['orient','connect','explain','show','practice','review','apply','continue','alternative','aiReview'] as const).map(field)}
      <p>Include a worked example, a new participant task, a review criterion and correction route. The accessible alternative must let someone perform and check the same action.</p></div>
    <div><h3>3. Test an action and retain the limits</h3><label>Test evidence type<select value={testType} onChange={e => setTestType(e.target.value)}><option value="self_test">Self-test — your own check</option><option value="simulation">Simulation — not actual staff evidence</option><option value="authorized_participant_test">Authorized participant test — record its source and limits</option></select></label>
      {(['testEvidence','barrierLink','observableAction','remaining','decisionNote'] as const).map(field)}
      <p>Attendance alone is not readiness evidence. Show input selection, correction or review routing on a new fictional case. Do not turn simulation into actual staff agreement.</p>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I checked usable action, accuracy, support and the accessible alternative; tied actions to evidenced gaps; and retained actual test and permission limits.</label></div>
    <div className="p2-workflow-practice-save">{enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save readiness resource to My Project Record'}</button> : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText,'Lesson 3.4 readiness resource copied with evidence and limits.')}>Copy my Lesson 3.4 record</button>
      <details><summary>Read or copy my readiness resource</summary><textarea aria-label="Lesson 3.4 readiness record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your readiness actions and resource are ready to save for review.' : 'Complete five evidence-based judgments, gap actions, all eight resource steps, alternative, test evidence and review check before saving.')}</p>
      <p>Saving preserves earlier adoption-plan work. Use the associated Journey Three workbook section; do not create a separate training workbook. Carry this work into Lesson 3.5.</p></div>
  </section>
}
