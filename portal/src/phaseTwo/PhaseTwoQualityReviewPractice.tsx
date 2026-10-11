import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "projectContext": "Continuing capstone, charter, and privacy-safe evidence references",
  "relevant": "Relevant: need, audience, intended use, and charter fit",
  "evidenced": "Evidenced: claims, sources, tests, versions, and missing support",
  "accountable": "Accountable: actual human owner and review/correction route",
  "designed": "Designed: usability, accessibility observations, alternatives, and limits",
  "yours": "Yours: personal judgment, truthful authorship, and supporting decisions",
  "aiReview": "AI review suggestions accepted, revised, or rejected and why",
  "correction": "Important weakness and before-and-after correction",
  "check": "Actual follow-up check, current version, and remaining uncertainty",
  "statement": "Final Responsible Practice Statement in your own language",
  "disclosure": "AI-role disclosure: actual AI support, human work, audience, and placement",
  "unresolved": "Unresolved issues and their consequence for intended use",
  "useDecision": "Applied explanation: remaining limit, appropriate or narrowed use, and human correction",
  "evidenceIndex": "Saved READY review, corrections, final statements, and evidence index"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoQualityReviewPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.capstone_integration_package as { quality_review_lesson_6_3?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.quality_review_lesson_6_3?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Use privacy-safe references to the same retained course work.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[package]', [draft.projectContext, draft.relevant, draft.evidenced, draft.accountable, draft.designed, draft.yours].filter(Boolean).join('\n') || '[Add the privacy-safe capstone package and evidence references]')
  const evidence = { lesson: '6.3', draft, ready_quality_review: { relevant: draft.relevant, evidenced: draft.evidenced,
    accountable: draft.accountable, designed: draft.designed, yours: draft.yours }, ai_review_and_human_decision: draft.aiReview,
    correction: draft.correction, follow_up_check: draft.check, responsible_practice_statement: draft.statement,
    ai_role_disclosure_and_context: draft.disclosure, unresolved_issues: draft.unresolved,
    limitation_use_and_correction_explanation: draft.useDecision, evidence_index: draft.evidenceIndex,
    human_review_confirmed: checked, ai_request: request, assigns_certification: false }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['statement','disclosure','useDecision'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { capstone_integration_package: { quality_review_lesson_6_3: evidence }, responsible_practice_statement: { final_statement_lesson_6_3: { statement: draft.statement, ai_role_disclosure: draft.disclosure, unresolved_issues: draft.unresolved, evidence_index: draft.evidenceIndex, human_review_confirmed: checked } } }, decisionNote: 'Lesson 6.3 — ' + draft.useDecision })
      setStatus('READY review and Responsible Practice Statement saved to your continuing Project Record. Version ' + result.saved_version + '. Keep actual evidence, decisions and unresolved limits visible.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-quality-review-title">
    <header><p className="eyebrow">READY Quality Review • Human ownership • Honest limits</p>
      <h2 id="p2-quality-review-title">Review your capstone with READY</h2>
      <p>Review the same finished version. Relevant, Evidenced, Accountable, Designed, and Yours check its quality and responsibility. This is distinct from READY Automation Screen and does not assign certification.</p></header>
    <div><h3>1. Open the finished package and apply READY</h3>{(['projectContext','relevant','evidenced','accountable','designed','yours'] as const).map(field)}
      <label>READY Quality Review AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Privacy-safe READY request copied. Inspect each suggestion; AI does not assign certification.')}>Copy READY Quality Review AI request</button>{field('aiReview')}</div>
    <div><h3>2. Correct and check the important weakness</h3>{(['correction','check'] as const).map(field)}
      <p>Match safeguards to the current artifact. Preserve the before and after version and record an actual follow-up check. Required defects remain pending until corrected.</p></div>
    <div><h3>3. Finalize your statement and disclosure</h3>{(['statement','disclosure'] as const).map(field)}
      <p>Use your own language. Describe concrete safeguards, truthful AI assistance, and actual human judgment. Choose a disclosure location appropriate to your audience.</p></div>
    <div><h3>4. Explain the limit and appropriate use</h3>{(['unresolved','useDecision','evidenceIndex'] as const).map(field)}
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I checked all five READY Quality Review areas, corrections, source support, authorship, accessibility observations, statement, disclosure, limits, and human review/correction route.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save READY Review and Responsible Practice Statement to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 6.3 quality review copied.')}>Copy my Lesson 6.3 record</button>
      <details><summary>Read or copy my quality review</summary><textarea aria-label="Lesson 6.3 quality review record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your READY review and final statements are ready to save.' : 'Complete the five checks, correction, follow-up, statements, unresolved issues, and use explanation before saving.')}</p>
      <p>Complete the connected Journey Six workbook. Carry the same reviewed package into Lesson 6.4 — Demonstrate the Project and Answer Questions. Earlier project evidence is preserved.</p>
    </div>
  </section>
}
