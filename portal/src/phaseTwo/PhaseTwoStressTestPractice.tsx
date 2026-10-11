import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "projectContext": "Continuing project and integrated artifact references",
  "boundary": "Test type, permission, scope and exclusions",
  "alignment": "Map, guidance, screen, controls, impact review and decision alignment",
  "normalInput": "Normal case: input and expected human response",
  "normalActual": "Normal case: actual result and evidence",
  "errorInput": "Error case: conflicting input and expected human response",
  "errorActual": "Error case: actual result and evidence",
  "exceptionInput": "Exception: unavailable tool, outside-authority request and expected response",
  "exceptionActual": "Exception: actual takeover, manual work, wait and evidence",
  "notice": "Permitted recipient notice: actual role, route and observed status",
  "handoff": "Interruption record and confirmed owner or backup handoff",
  "comparison": "Operating document versus actual behavior: agreements and gaps",
  "failed": "One failed safeguard: first actual result and consequence",
  "correction": "Before-and-after correction and human review",
  "retest": "Same challenge: actual retest result, evidence and limits",
  "safe": "SAFE review of observed result and information handling",
  "factsImpact": "FACTS and IMPACT review: claims, uncertainty and people affected",
  "trace": "TRACE Record: task, role, artifacts, checks, explanation and accountability",
  "pause": "PAUSE review and proportionate human next-use decision",
  "owners": "System owner, stopping, correction, escalation and restart authority",
  "monitoring": "Monitoring: owner, observable check and confirmed event or schedule",
  "maintenance": "Residual risks, maintenance owner and change-review trigger",
  "wider": "Evidence and approval needed before wider use",
  "demonstration": "Functioning correction or fallback demonstration and most important correction note"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoStressTestPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.governance_literacy_evidence as { stress_test_lesson_5_6?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.stress_test_lesson_5_6?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Keep SAFE and actual test evidence; use fictional or sanitized material.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[plan]', [draft.projectContext, draft.boundary, draft.alignment, draft.normalInput, draft.errorInput, draft.exceptionInput].filter(Boolean).join('\n') || '[Add sanitized scope, permission and expected responses]')
  const evidence = { lesson: '5.6', draft, integrated_artifacts: draft.projectContext, test_boundary_and_type: draft.boundary, document_alignment: draft.alignment,
    scenarios: { normal: { input_and_expected: draft.normalInput, actual_and_evidence: draft.normalActual }, error: { input_and_expected: draft.errorInput, actual_and_evidence: draft.errorActual }, exception: { input_and_expected: draft.exceptionInput, actual_and_evidence: draft.exceptionActual } },
    recipient_notice: draft.notice, interruption_and_handoff: draft.handoff, document_behavior_comparison: draft.comparison,
    safeguard_correction: { first_failed_result: draft.failed, before_and_after: draft.correction, actual_retest_and_limits: draft.retest },
    integrated_reviews: { safe: draft.safe, facts_and_impact: draft.factsImpact, trace: draft.trace, pause: draft.pause },
    ownership: draft.owners, monitoring: draft.monitoring, residual_risks_and_maintenance: draft.maintenance,
    wider_use_evidence_and_approval: draft.wider, functioning_route_demonstration: draft.demonstration,
    human_review_confirmed: checked, ai_request: request, certifies_live_tool_reliability: false, authorizes_production_use: false }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['normalActual', 'errorActual', 'exceptionActual', 'correction', 'retest', 'demonstration'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { governance_literacy_evidence: { stress_test_lesson_5_6: evidence } }, decisionNote: 'Lesson 5.6 — ' + draft.pause })
      setStatus('Stress-test evidence saved to your continuing Project Record. Version ' + result.saved_version + '. Keep actual evidence, decisions and unresolved limits visible.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-stress-title">
    <header><p className="eyebrow">Integrated operating test • Correction • Human takeover</p>
      <h2 id="p2-stress-title">Demonstrate the responsible operating route</h2>
      <p>Continue the same project. Use an integrated tabletop or authorized sandbox with fictional or sanitized material. State test type and permission; no real reminders are sent in the fictional exercise.</p></header>
    <div><h3>1. Assemble the integrated test</h3>{(['projectContext', 'boundary', 'alignment'] as const).map(field)}
      <p>Bring the map, operating guidance, automation screen, data controls, impact review and accountable decision. Check consistent roles, conditions, handoffs and completion signals.</p>
      <label>Integrated scenario AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Sanitized scenario request copied. Check scope, authority and expected human responses.')}>Copy integrated scenario AI request</button></div>
    <div><h3>2. Run normal, error and exception cases</h3>{(['normalInput', 'normalActual', 'errorInput', 'errorActual', 'exceptionInput', 'exceptionActual', 'notice', 'handoff', 'comparison'] as const).map(field)}
      <p>Write expectations first. Include unavailable tools and a request outside authority. Inspect manual work, actions that must wait, the permitted recipient notice and interruption record. Distinguish a tabletop result from actual sandbox behavior.</p></div>
    <div><h3>3. Correct and retest the safeguard</h3>{(['failed', 'correction', 'retest', 'safe', 'factsImpact', 'trace', 'pause'] as const).map(field)}
      <p>Retain one failed safeguard, its precise before-and-after correction and the actual retest of the same challenge. Apply SAFE, FACTS and IMPACT, TRACE and PAUSE to observed results. Keep unperformed tests pending.</p></div>
    <div><h3>4. Demonstrate ownership and retain the journey result</h3>{(['owners', 'monitoring', 'maintenance', 'wider', 'demonstration'] as const).map(field)}
      <p>Show a functioning correction or fallback route. Name who owns, stops and corrects the system, monitoring and maintenance, residual risks, and the evidence and approval needed before wider use.</p>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I checked the integrated artifacts, actual three-case results, human takeover, correction and retest, responsibility records, ownership, remaining limits and functioning route demonstration.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save stress-test evidence to My Project Record'}</button>
        : <p>Copy your work to keep it. Saving to My Project Record requires an active enrollment.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 5.6 stress-test evidence copied.')}>Copy my Lesson 5.6 record</button>
      <details><summary>Read or copy my integrated operating record</summary><textarea aria-label="Lesson 5.6 operating record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your operating evidence and human review are ready to save.' : 'Complete the cases, correction, retest, responsibilities and demonstration before saving.')}</p>
      <p>Complete the connected Journey Five workbook and carry the same artifacts into Journey Six — Demonstrate and Execute. Earlier project work is preserved.</p>
    </div>
  </section>
}
