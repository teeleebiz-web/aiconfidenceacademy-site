import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "projectContext": "Continuing capstone, current version, charter, and safe references",
  "journey1": "Journey One result: retained evidence, version, and status",
  "journey2": "Journey Two result: retained evidence, version, and status",
  "journey3": "Journey Three result: retained evidence, version, and status",
  "journey4": "Journey Four result: retained evidence, version, and status",
  "journey5": "Journey Five result: retained evidence, version, and status",
  "journey6": "Journey Six result: retained evidence, version, and status",
  "artifact": "Functioning bounded artifact, tests, and revision evidence",
  "reflection": "Final growth reflection: changed decision, improved result, and evidence",
  "demonstration": "Final demonstration reference and actual questions/responses or labeled rehearsal",
  "gaps": "Remaining issue, focused correction, affected retest, and honest unresolved status",
  "responsible": "Responsible statement, ownership, human decisions, and actual AI assistance",
  "positioning": "Verified positioning set and existing Lesson 6.5 action references",
  "day30": "30-day plan: action, owner/collaborator, permission, boundary, checkpoint, decision",
  "day60": "60-day plan: action, owner/collaborator, permission, boundary, checkpoint, decision",
  "day90": "90-day plan: action, owner/collaborator, permission, boundary, checkpoint, decision",
  "support": "Support, unresolved dependencies, backup, and sustained quality review",
  "aiReview": "AI gap review: suggestions accepted, corrected, or rejected with reasons",
  "finalCheck": "Final file review: privacy-safe evidence, sources, versions, and human decisions",
  "submission": "Established submission route, Sunday deadline, actual delivery and acknowledgment status"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoCloseoutPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
  const [draft, setDraft] = useState<Draft>(blank)
  const [checked, setChecked] = useState(false)
  const [project, setProject] = useState<{ path: PhaseTwoProjectPath; title: string } | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setDraft(blank()); setChecked(false); setProject(null); setStatus('')
    if (!enrollmentId) return
    let active = true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active || !record) return
      setProject({ path: record.project_path, title: record.project_title })
      const section = record.sections.capstone_integration_package as { closeout_lesson_6_6?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.closeout_lesson_6_6?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Use privacy-safe references to the same retained course work.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[inputs]', [draft.projectContext, ...(['journey1','journey2','journey3','journey4','journey5','journey6','artifact','gaps','day30','day60','day90'] as const).map(k => fields[k] + ': ' + draft[k])].filter(Boolean).join('\n'))
  const evidence = { lesson: '6.6', draft, six_journey_index: Object.fromEntries([1,2,3,4,5,6].map(n => [n, draft[('journey'+n) as keyof Draft]])),
    artifact_tests_and_revision: draft.artifact, growth_reflection: draft.reflection, final_demonstration_and_questions: draft.demonstration,
    gaps_and_focused_correction: draft.gaps, responsible_statement_and_ownership: draft.responsible, positioning_references: draft.positioning,
    execution_plan: { day_30: draft.day30, day_60: draft.day60, day_90: draft.day90 }, support_backup_and_sustain: draft.support,
    inspected_ai_review: draft.aiReview, final_file_check: draft.finalCheck, actual_submission_status: draft.submission,
    human_review_confirmed: checked, ai_request: request, assigns_certification: false, saving_confirms_delivery: false }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['reflection','day30','day60','day90','submission'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { capstone_integration_package: { closeout_lesson_6_6: evidence } }, decisionNote: 'Lesson 6.6 — ' + draft.gaps })
      setStatus('Portfolio closeout and execution plan notes saved to your continuing Project Record. Version ' + result.saved_version + '. Keep actual evidence, decisions and unresolved limits visible.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-closeout-title">
    <header><p className="eyebrow">PROGRESS Closeout • Portfolio • Execution plan</p><h2 id="p2-closeout-title">Assemble your portfolio and execution plan</h2>
      <p>Use retained evidence from all six journeys. Save closeout notes here; submit final files through the established Academy route. Saving notes does not send files, confirm receipt, or award a credential.</p></header>
    <div><h3>1. Index the six journey results</h3>{(['projectContext','journey1','journey2','journey3','journey4','journey5','journey6'] as const).map(field)}</div>
    <div><h3>2. Review growth, ownership, and gaps</h3>{(['artifact','reflection','demonstration','gaps','responsible','positioning'] as const).map(field)}
      <p>Cite a changed decision and supported improvement. Label rehearsal and fictional evidence. Make focused corrections where evidence is missing.</p></div>
    <div><h3>3. Plan 30, 60, and 90 days</h3>{(['day30','day60','day90','support'] as const).map(field)}
      <p>Name actions, actual owners or collaborators, needed permissions, boundaries, evidence checkpoints, and next decisions. Wider use remains conditional.</p>
      <label>Verified closeout AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Privacy-safe closeout request copied. Inspect suggestions against retained evidence.')}>Copy verified closeout AI request</button>{field('aiReview')}</div>
    <div><h3>4. Verify files and retain actual submission status</h3>{(['finalCheck','submission'] as const).map(field)}
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I checked the required evidence, privacy, sources, versions, human decisions, and execution plan, and recorded any unresolved issue and actual submission status honestly.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Portfolio Closeout and Execution Plan Notes to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 6.6 closeout record copied.')}>Copy my Lesson 6.6 record</button>
      <details><summary>Read or copy my closeout record</summary><textarea aria-label="Lesson 6.6 closeout record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your checked closeout notes are ready to save. Saving does not confirm delivery.' : 'Complete every field and human review before saving. Keep missing evidence and unconfirmed receipt visible.')}</p>
      <p>Submit by Sunday of Week Six through the established Academy route and retain the actual acknowledgment when available. The authorized Academy reviewer decides credentials using the governing rubric. Continue independent work with the saved plan; review time is administrative.</p>
    </div>
  </section>
}
