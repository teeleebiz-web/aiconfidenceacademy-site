import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'
import type { PhaseTwoStrengthening } from './PhaseTwoEvidenceGuidance'

const fields = {
  "projectContext": "Continuing project, charter, and privacy-safe artifact references",
  "baseline": "Baseline version and original success criteria",
  "criteria": "Criterion comparison: supported, unmet, or not yet established",
  "buildPlan": "Staged BUILD plan: remaining build, review, and tests",
  "aiReview": "Useful AI request/output and human decision",
  "normalTest": "Ordinary test: input, expected, observed, result, and version",
  "exceptionTest": "Known exception: input, expected, observed, result, and version",
  "feedback": "Feedback method, actual observation, and response",
  "revision": "Material correction: before, after, and why it matters",
  "retest": "Retest of the correction and other affected paths",
  "scope": "Scope reconciliation and unestablished outcomes",
  "evidenceIndex": "Finished artifact and meaningful evidence/version index",
  "demonstration": "Completion explanation: show result, correction, charter fit, and limits"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoArtifactFinishPractice({ enrollmentId, approvedAiRequest, repairCase }: { enrollmentId?: string; approvedAiRequest: string; repairCase?: PhaseTwoStrengthening['repair_case'] }) {
  const [draft, setDraft] = useState<Draft>(blank)
  const [checked, setChecked] = useState(false)
  const [project, setProject] = useState<{ path: PhaseTwoProjectPath; title: string } | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [repairSource,setRepairSource]=useState<'own_project'|'earlier_project_revision'|'supplied_exercise'>('own_project')
  useEffect(() => {
    setDraft(blank()); setChecked(false); setProject(null); setStatus('')
    if (!enrollmentId) return
    let active = true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active || !record) return
      setProject({ path: record.project_path, title: record.project_title })
      const section = record.sections.capstone_integration_package as { artifact_finish_lesson_6_2?: { draft?: Partial<Draft>; repair_source?: string } } | undefined
      const saved = section?.artifact_finish_lesson_6_2?.draft
      const source=section?.artifact_finish_lesson_6_2?.repair_source
      if(source==='supplied_exercise'||source==='earlier_project_revision')setRepairSource(source)
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Use privacy-safe references to the same retained course work.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[artifact and tests]', [draft.projectContext, draft.baseline, draft.criteria, draft.normalTest, draft.exceptionTest].filter(Boolean).join('\n') || '[Add privacy-safe artifact, criteria, and actual test notes]')
  const evidence = { lesson: '6.2', draft, baseline: draft.baseline, criteria_comparison: draft.criteria,
    repair_source: repairSource, supplied_exercise_proves_project_readiness: false,
    build_plan: draft.buildPlan, ai_review_and_human_decision: draft.aiReview,
    tests: { normal: draft.normalTest, exception: draft.exceptionTest }, feedback: draft.feedback,
    material_revision: draft.revision, retest: draft.retest, scope_reconciliation: draft.scope,
    finished_artifact_and_evidence_index: draft.evidenceIndex, completion_demonstration: draft.demonstration,
    human_review_confirmed: checked, ai_request: request }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['revision', 'demonstration'].includes(k) ? 5 : 3} value={draft[k]}
      onChange={e => { setDraft(old => ({ ...old, [k]: e.target.value })); setChecked(false) }} /></label>
  }
  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); setStatus(message) }
    catch { setStatus('Clipboard is unavailable. Select the displayed request or record to copy it.') }
  }
  async function save() {
    if (!enrollmentId || !project || !complete || saving) return
    setSaving(true); setStatus('')
    try {
      const result = await savePhaseTwoProjectUpdate({ enrollmentId, path: project.path, title: project.title,
        patch: { capstone_integration_package: { artifact_finish_lesson_6_2: evidence } }, decisionNote: 'Lesson 6.2 — ' + draft.demonstration })
      setStatus('Capstone Integration Package saved to your continuing Project Record. Version ' + result.saved_version + '. Keep actual evidence, decisions and unresolved limits visible.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-artifact-finish-title">
    <header><p className="eyebrow">Bounded result • Material correction • Retest evidence</p>
      <h2 id="p2-artifact-finish-title">Finish your artifact with evidence</h2>
      <p>Use the same project and original charter. Keep required criteria pending until your actual work supports them. Label feedback and evidence accurately.</p></header>
    <div><h3>1. Compare the charter and baseline</h3>{(['projectContext','baseline','criteria'] as const).map(field)}
      <label>Bounded revision AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Privacy-safe revision request copied. Inspect the suggestions against your charter.')}>Copy bounded revision AI request</button></div>
    <div><h3>2. Lead the BUILD correction</h3>{(['buildPlan','aiReview','revision'] as const).map(field)}
      {repairCase&&<>
        <label>Source of the correction evidence<select value={repairSource} onChange={e=>{setRepairSource(e.target.value as typeof repairSource);setChecked(false)}}>
          <option value="own_project">Current project revision</option><option value="earlier_project_revision">Earlier retained project correction and retest</option><option value="supplied_exercise">Supplied fictional repair exercise</option>
        </select></label>
        <p>Reuse an earlier material project correction and its actual retest when it still applies to this version. If all project criteria are already supported and no material defect is observed, use the supplied exercise for repair skill. Your own finished artifact still needs its ordinary and exception checks and charter evidence.</p>
        {repairSource==='supplied_exercise'&&<div><p>{repairCase.setup}</p><p>{repairCase.input}</p><p>{repairCase.faulty_artifact}</p><p>{repairCase.task}</p></div>}
      </>}
      <p>Baseline, use AI, inspect, lead, and demonstrate. Explain the human decision and preserve meaningful before and after versions.</p></div>
    <div><h3>3. Test, obtain feedback, and retest</h3>{(['normalTest','exceptionTest','feedback','retest'] as const).map(field)}
      <p>Record inputs, expected and observed behavior, results, and versions. Criteria-based feedback is not approval by a person. Retest the correction and other affected paths.</p></div>
    <div><h3>4. Reconcile the scope and show the result</h3>{(['scope','evidenceIndex','demonstration'] as const).map(field)}
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I checked the finished artifact against the charter, reviewed the correction and actual retest evidence, labeled feedback accurately, and made remaining limits visible.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Capstone Integration Package to My Project Record'}</button>
        : <p>Copy your work to keep it. Saving to My Project Record requires an active enrollment.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 6.2 artifact evidence copied.')}>Copy my Lesson 6.2 record</button>
      <details><summary>Read or copy my artifact evidence</summary><textarea aria-label="Lesson 6.2 artifact record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your artifact evidence and human review are ready to save.' : 'Complete the charter comparison, revision, tests, feedback, retest, scope, and demonstration before saving.')}</p>
      <p>Complete the connected Journey Six workbook. Carry the same finished artifact and evidence into Lesson 6.3 for the quality, responsibility, and readiness review. Earlier project work is preserved.</p>
    </div>
  </section>
}
