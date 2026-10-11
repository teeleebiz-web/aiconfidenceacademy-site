import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "context": "Continuing project and SAFE evidence reference",
  "output": "Meaningful fictional or sanitized output",
  "claimReview": "Facts: material claims and their review",
  "sources": "Verification sources, dates, findings and limits",
  "assumptions": "Assumptions and the one changed after testing",
  "missingContext": "Context: missing essentials and clarification",
  "expected": "Test: expected bounded behavior",
  "variationA": "Equivalent variation A input",
  "resultA": "Actual response to variation A",
  "variationB": "Equivalent variation B input",
  "resultB": "Actual response to variation B",
  "errorInput": "One error-case input",
  "errorResult": "Actual error-case response",
  "comparison": "Human comparison of the three results",
  "stakeholders": "Stakeholders: who might bear a problem",
  "impact": "Impact: observed results and plausible burdens",
  "correction": "Material correction: before and after",
  "retest": "Retest evidence or explicit pending action",
  "findings": "Verified finding and unresolved accuracy or fairness question",
  "decision": "Human continue, revise or pause decision and reason",
  "nextEvidence": "Appropriate escalation and next evidence"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoFactsImpactPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.governance_literacy_evidence as { facts_impact_lesson_5_2?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.facts_impact_lesson_5_2?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, context: record.project_title + ' — Path ' + record.project_path + '. Keep the Lesson 5.1 SAFE evidence; select fictional or sanitized output for this review.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[sanitized output]', draft.output || '[Add fictional or sanitized output only]')
  const evidence = { lesson: '5.2', draft,
    facts_and_impact: { facts: draft.claimReview, assumptions: draft.assumptions, context: draft.missingContext,
      test: { expected: draft.expected, variations: [{ input: draft.variationA, actual: draft.resultA }, { input: draft.variationB, actual: draft.resultB }], error_case: { input: draft.errorInput, actual: draft.errorResult }, comparison: draft.comparison },
      stakeholders: draft.stakeholders, impact: draft.impact },
    verification_sources: draft.sources, material_correction: draft.correction, retest_evidence_or_pending_action: draft.retest,
    verified_finding_and_unresolved_question: draft.findings, human_review_decision: draft.decision,
    human_review_confirmed: checked, next_evidence_and_escalation: draft.nextEvidence, ai_request: request,
    certifies_universal_accuracy_or_fairness: false, authorizes_live_queue_change: false }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['output', 'resultA', 'resultB', 'errorResult', 'correction'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { governance_literacy_evidence: { facts_impact_lesson_5_2: evidence } }, decisionNote: 'Lesson 5.2 — ' + draft.decision })
      setStatus('FACTS and IMPACT review saved to your continuing Project Record. Version ' + result.saved_version + '. Your finding remains limited to its evidence and tests.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-facts-impact-title">
    <header><p className="eyebrow">Facts • Assumptions • Context • Test • Stakeholders • Impact</p>
      <h2 id="p2-facts-impact-title">Check the output before you rely on it</h2>
      <p>Continue the same project under SAFE. Use fictional or sanitized material; do not enter private records or credentials.</p></header>
    <div><h3>1. Select the output and inspect its evidence</h3>{(['context', 'output', 'claimReview', 'sources', 'assumptions', 'missingContext'] as const).map(field)}
      <p>Accuracy concerns truth; completeness concerns missing essentials; relevance concerns the task; fairness concerns assumptions and unequal burdens.</p>
      <label>FACTS and IMPACT AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Sanitized review request copied. Verify the evidence yourself.')}>Copy FACTS and IMPACT AI request</button></div>
    <div><h3>2. Run equivalent variations and one error case</h3>{(['expected', 'variationA', 'resultA', 'variationB', 'resultB', 'errorInput', 'errorResult', 'comparison'] as const).map(field)}
      <p>Hold the task, deadline and work impact constant while varying phrasing. Set expected behavior before testing. Record actual responses. For conflicting information, expect clarification rather than an invented fact.</p></div>
    <div><h3>3. Consider who could bear a problem</h3>{(['stakeholders', 'impact'] as const).map(field)}
      <p>Separate observed results from plausible effects. Do not infer identity, ability or importance from writing style.</p></div>
    <div><h3>4. Correct the material weakness and decide</h3>{(['correction', 'retest', 'findings', 'decision', 'nextEvidence'] as const).map(field)}
      <p>Keep a verified finding, unresolved question and proposed action distinct. A few tests do not certify universal accuracy or fairness. Pause and escalate questions beyond your evidence or authority.</p>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I reviewed all six lenses, source evidence, two equivalent variations and one error case with actual responses, affected people, material correction, retest status, limits and my human decision.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save FACTS and IMPACT review to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 5.2 review copied.')}>Copy my Lesson 5.2 record</button>
      <details><summary>Read or copy my review record</summary><textarea aria-label="Lesson 5.2 review record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your review and human decision are ready to save.' : 'Complete the evidence review, three tests, correction and human decision before saving.')}</p>
      <p>Keep the connected Journey Five workbook and carry the same project into Lesson 5.3. Earlier project work is preserved.</p>
    </div>
  </section>
}
