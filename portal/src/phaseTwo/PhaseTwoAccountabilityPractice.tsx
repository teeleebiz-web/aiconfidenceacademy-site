import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "projectContext": "Continuing project, SAFE and prior test evidence",
  "govern": "GOVERN: goal, owners, values, evidence, rules and notice",
  "policy": "Actual policy and approval references, authority and unresolved gaps",
  "task": "TRACE task: exact action and use boundary",
  "role": "TRACE role: actual AI contribution and human duties",
  "artifacts": "TRACE artifacts: retained input, output and evidence references",
  "checks": "TRACE checks: actual verification and unresolved evidence",
  "explanation": "TRACE explanation: evidence, limit and consequence",
  "accountability": "TRACE accountability: confirmed decision and stopping roles",
  "purpose": "PAUSE purpose: bounded intended benefit",
  "affected": "PAUSE affected people: reliance and burden of error",
  "uncertainty": "PAUSE uncertainty: unknown facts and consequences",
  "safeguards": "PAUSE safeguards: observed controls and untested assumptions",
  "escalation": "PAUSE escalation: confirmed owner, route and authority",
  "decision": "Decision memo: chosen action, evidence, consequence and boundary",
  "notice": "Proportionate notice: AI role, human check, limit and contact",
  "monitoring": "Monitoring: confirmed owner, check and action trigger",
  "correction": "Correction and stopping: owner, permitted action and restart authority",
  "statement": "Responsible Practice Statement: concrete personal commitments",
  "reassessment": "Reassessment trigger: recognizable event and review owner",
  "privacy": "Public evidence boundary: sanitized references and confidential location",
  "critique": "Verified AI critique: accepted changes and unsupported suggestions"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoAccountabilityPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.governance_literacy_evidence as { accountability_lesson_5_5?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.accountability_lesson_5_5?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Keep SAFE and actual test evidence; use fictional or sanitized material.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[evidence]', [draft.projectContext, draft.govern, draft.checks, draft.decision, draft.uncertainty, draft.safeguards, draft.escalation].filter(Boolean).join('\n') || '[Add sanitized evidence and the proposed decision]')
  const evidence = { lesson: '5.5', draft, govern_view: draft.govern, policy_and_approval_references: draft.policy,
    trace_record: { task: draft.task, role: draft.role, artifacts: draft.artifacts, checks: draft.checks, explanation: draft.explanation, accountability: draft.accountability },
    pause_decision_gate: { purpose: draft.purpose, affected_people: draft.affected, uncertainty: draft.uncertainty, safeguards: draft.safeguards, escalation: draft.escalation },
    decision_memo: draft.decision, proportionate_notice: draft.notice,
    responsibilities: { monitoring: draft.monitoring, correction_stopping_and_restart: draft.correction, escalation: draft.escalation },
    responsible_practice_statement: draft.statement, reassessment_trigger: draft.reassessment,
    public_evidence_boundary: draft.privacy, verified_ai_critique: draft.critique,
    human_review_confirmed: checked, ai_request: request, declares_legal_compliance: false, authorizes_production_use: false }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['govern', 'checks', 'decision', 'notice', 'statement'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { governance_literacy_evidence: { accountability_lesson_5_5: evidence } }, decisionNote: 'Lesson 5.5 — ' + draft.decision })
      setStatus('Accountability evidence saved to your continuing Project Record. Version ' + result.saved_version + '. Keep actual evidence, decisions and unresolved limits visible.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-accountability-title">
    <header><p className="eyebrow">GOVERN View • TRACE Record • PAUSE Decision Gate</p>
      <h2 id="p2-accountability-title">Make the human decision visible</h2>
      <p>Continue the same project under SAFE. Bring actual tests, operating guidance and unresolved limits. Use fictional or sanitized material; keep confidential details out of public evidence.</p></header>
    <div><h3>1. Check governance and real authority</h3>{(['projectContext', 'govern', 'policy'] as const).map(field)}
      <p>GOVERN: goal, owners, values, evidence, rules and notice. Distinguish policy, standard, procedure, control, risk and incident. Verify actual permission and decision authority.</p></div>
    <div><h3>2. Organize the TRACE Record</h3>{(['task', 'role', 'artifacts', 'checks', 'explanation', 'accountability'] as const).map(field)}
      <p>Retain the task, role, artifacts, checks, explanation and accountability. A useful draft does not establish that an action occurred. Record missing independent evidence; an AI confidence score cannot supply approval.</p></div>
    <div><h3>3. Apply PAUSE to the whole project</h3>{(['purpose', 'affected', 'uncertainty', 'safeguards', 'escalation'] as const).map(field)}
      <p>Consider purpose, affected people, uncertainty, safeguards and escalation. Inspect actual controls and human ownership, including who bears an error.</p>
      <label>TRACE and PAUSE AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Sanitized decision review request copied. Verify the critique against actual evidence and authority.')}>Copy decision review AI request</button></div>
    <div><h3>4. Retain the decision and responsibility</h3>{(['decision', 'notice', 'monitoring', 'correction', 'statement', 'reassessment', 'privacy', 'critique'] as const).map(field)}
      <p>Choose proceed, proceed with safeguards, limited test, pause and redesign, or qualified review. Defend the choice using evidence and consequence. Explain the actual AI role and human contact. Name who can stop or correct the work and a recognizable reassessment trigger.</p>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I checked real policy and authority, all TRACE and PAUSE parts, evidence and consequence, notice, human responsibilities, personal commitments, confidential information boundaries and reassessment.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save accountability evidence to My Project Record'}</button>
        : <p>Copy your work to keep it. Saving to My Project Record requires an active enrollment.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 5.5 accountability evidence copied.')}>Copy my Lesson 5.5 record</button>
      <details><summary>Read or copy my accountability record</summary><textarea aria-label="Lesson 5.5 accountability record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your evidence and human decision are ready to save.' : 'Complete the record, decision, notice and responsibilities before saving.')}</p>
      <p>Keep the connected Journey Five workbook and carry the same project into Lesson 5.6. Earlier project work is preserved.</p>
    </div>
  </section>
}
