import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "projectContext": "Continuing project, SAFE and CLEARER evidence",
  "flowMap": "Future-state FLOW Map: all nine elements",
  "care": "CARE: clarity, access, reliability, effort and evidence",
  "stepOne": "READY screen for step one: five checks, evidence and decision",
  "stepTwo": "READY screen for step two: five checks, evidence and decision",
  "stepThree": "READY screen for step three: five checks, evidence and decision",
  "improvement": "One small improvement and expected benefit",
  "before": "Before: observed effort, conditions and included work",
  "after": "After: observed effort, conditions and included work",
  "comparison": "Supported improvement finding and limits",
  "failureInput": "Failure sample, test type and expected behavior",
  "failureActual": "Actual failure result: stop, notification and preserved case",
  "backupInput": "Backup sample, test type and expected behavior",
  "backupActual": "Actual backup result: access, authority and usable handoff",
  "corrections": "Correction and actual retest results or pending check",
  "owners": "Operations Responsibility Statement: primary and backup ownership",
  "takeover": "Human-led step and yes-or-no takeover trigger",
  "monitoring": "Monitoring owner, checks and confirmed frequency or gap",
  "fallback": "Permitted fallback and paused state",
  "maintenance": "Maintenance owner, change review and recheck",
  "decision": "Human continue, limit or pause decision with evidence"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoContinuityPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.governance_literacy_evidence as { continuity_lesson_5_4?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.continuity_lesson_5_4?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Keep SAFE, CLEARER and actual test evidence; use fictional or sanitized material.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[draft]', [draft.projectContext, draft.flowMap, draft.before, draft.after, draft.failureActual, draft.backupActual].filter(Boolean).join('\n') || '[Add the sanitized map and actual evidence]')
  const evidence = { lesson: '5.4', draft, future_state_flow_map: draft.flowMap, care_improvement_check: draft.care,
    ready_three_step_screen: [draft.stepOne, draft.stepTwo, draft.stepThree],
    improvement_test: { change_and_expected_benefit: draft.improvement, before: draft.before, after: draft.after, supported_finding_and_limits: draft.comparison },
    failure_test: { input_type_and_expected: draft.failureInput, actual: draft.failureActual },
    backup_test: { input_type_and_expected: draft.backupInput, actual: draft.backupActual },
    correction_and_retest_status: draft.corrections,
    operations_responsibility_statement: { owners: draft.owners, human_led_step_and_takeover: draft.takeover, monitoring: draft.monitoring, fallback: draft.fallback, maintenance: draft.maintenance },
    human_decision: draft.decision, human_review_confirmed: checked, ai_request: request,
    certifies_live_tool_reliability: false, authorizes_live_automation: false }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['flowMap', 'stepOne', 'stepTwo', 'stepThree', 'failureActual', 'backupActual'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { governance_literacy_evidence: { continuity_lesson_5_4: evidence } }, decisionNote: 'Lesson 5.4 — ' + draft.decision })
      setStatus('Continuity evidence saved to your continuing Project Record. Version ' + result.saved_version + '. Keep tested behavior, proposed changes and unresolved dependencies distinct.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-continuity-title">
    <header><p className="eyebrow">FLOW Map • CARE Improvement Check • READY Automation Screen</p>
      <h2 id="p2-continuity-title">Improve the handoff and keep responsibility visible</h2>
      <p>Continue the same project under SAFE with your CLEARER guidance. Use fictional or sanitized material and permitted simulation. Do not send real reminders in this exercise.</p></header>
    <div><h3>1. Expand the map and check the improvement</h3>{(['projectContext', 'flowMap', 'care'] as const).map(field)}
      <p>FLOW: front door, launch check, ownership, work steps, handoffs, decisions, wait states, exceptions and close. CARE: clarity, access, reliability, effort and evidence.</p></div>
    <div><h3>2. Screen three steps and compare effort</h3>{(['stepOne', 'stepTwo', 'stepThree', 'improvement', 'before', 'after', 'comparison'] as const).map(field)}
      <p>For each step, record READY evidence for repeatability, explicit rules, assessable output, dependable tools and a yes-or-no human takeover boundary. Include review, correction and follow-up in comparable effort observations. Keep an unmeasured benefit unverified.</p>
      <label>FLOW, CARE and READY AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Sanitized workflow review request copied. Verify actual behavior and benefit evidence.')}>Copy workflow review AI request</button></div>
    <div><h3>3. Test failure and the backup route</h3>{(['failureInput', 'failureActual', 'backupInput', 'backupActual', 'corrections'] as const).map(field)}
      <p>Expect a disputed reminder to stop, notify its owner and preserve the case. Test primary-owner unavailability and the backup's permitted access, authority and guidance. Retain actual observations; distinguish a simulation or walkthrough from a running-tool test.</p></div>
    <div><h3>4. Write the Operations Responsibility Statement</h3>{(['owners', 'takeover', 'monitoring', 'fallback', 'maintenance', 'decision'] as const).map(field)}
      <p>State what remains human-led, what triggers takeover and how another person can continue. Flag unconfirmed ownership, monitoring rules or authority. Save the future-state map, screen, improvement test and statement with their limits.</p>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I reviewed all nine FLOW elements, CARE, three READY screens, actual failure and backup evidence, effort comparison, corrections, operating responsibility and my human decision.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save continuity evidence to My Project Record'}</button>
        : <p>Copy your work to keep it. Saving to My Project Record requires an active enrollment.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 5.4 operating evidence copied.')}>Copy my Lesson 5.4 record</button>
      <details><summary>Read or copy my operating record</summary><textarea aria-label="Lesson 5.4 operating record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your operating evidence and human decision are ready to save.' : 'Complete the map, screens, tests, responsibility and human decision before saving.')}</p>
      <p>Keep the connected Journey Five workbook and carry the same project into Lesson 5.5. Earlier project work is preserved.</p>
    </div>
  </section>
}
