import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "projectContext": "Continuing project, SAFE boundaries and tested evidence",
  "format": "Chosen document format and reason",
  "sources": "Map, prototype, tests and permitted rules",
  "context": "Context: applicability and task boundary",
  "lead": "Lead: responsible owner and reviewer",
  "entry": "Entry: prerequisites and required inputs",
  "actions": "Actions: ordered work and checks",
  "result": "Result: quality requirements and completion evidence",
  "exceptions": "Exceptions: stop, reviewer and wait",
  "record": "Record: permitted evidence and location",
  "gaps": "Missing owners or rules and confirmation needed",
  "normalInput": "Normal-path sample and expected behavior",
  "normalActual": "Actual normal-path walkthrough result",
  "exceptionInput": "Exception sample and expected behavior",
  "exceptionActual": "Actual exception-path walkthrough result",
  "corrections": "Instructions requiring guessing: before and after",
  "retest": "Actual retest results or explicit pending action",
  "decision": "Human usability decision and limits",
  "completion": "When guidance applies, when it stops and why the format fits"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoOperatingGuidancePractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.governance_literacy_evidence as { operating_guidance_lesson_5_3?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.operating_guidance_lesson_5_3?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Keep SAFE, the workflow map and actual test evidence; use fictional or sanitized material.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[map and tests]', [draft.projectContext, draft.format, draft.sources, draft.gaps].filter(Boolean).join('\n') || '[Add the sanitized map and actual tests]')
  const evidence = { lesson: '5.3', draft,
    document_format_and_reason: draft.format, tested_source_evidence: draft.sources,
    clearer_operating_document: { context: draft.context, lead: draft.lead, entry: draft.entry, actions: draft.actions, result: draft.result, exceptions: draft.exceptions, record: draft.record },
    missing_owners_or_rules: draft.gaps,
    walkthrough: { normal: { input_and_expectation: draft.normalInput, actual: draft.normalActual }, exception: { input_and_expectation: draft.exceptionInput, actual: draft.exceptionActual } },
    before_after_corrections: draft.corrections, retest_evidence_or_pending_action: draft.retest,
    human_usability_decision: draft.decision, applied_completion_check: draft.completion,
    human_review_confirmed: checked, ai_request: request, invents_organizational_policy: false, authorizes_live_sending: false }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['actions', 'exceptions', 'normalActual', 'exceptionActual', 'corrections'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { governance_literacy_evidence: { operating_guidance_lesson_5_3: evidence } }, decisionNote: 'Lesson 5.3 — ' + draft.decision })
      setStatus('CLEARER operating guidance saved to your continuing Project Record. Version ' + result.saved_version + '. Keep its confirmed scope, stop conditions and unresolved dependencies visible.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-operating-guidance-title">
    <header><p className="eyebrow">Context • Lead • Entry • Actions • Result • Exceptions • Record</p>
      <h2 id="p2-operating-guidance-title">Write guidance another person can follow</h2>
      <p>Continue the same tested project under SAFE. Use fictional or sanitized material. CLEARER Operating Standard is distinct from CLEAR Quality Review.</p></header>
    <div><h3>1. Choose the format and evidence</h3>{(['projectContext', 'format', 'sources'] as const).map(field)}
      <p>Checklist for checks; procedure for ordered work; decision guide for branching judgment; template for consistent inputs; knowledge note for reference. Choose one compact document that fits the task.</p></div>
    <div><h3>2. Write the seven CLEARER parts</h3>{(['context', 'lead', 'entry', 'actions', 'result', 'exceptions', 'record', 'gaps'] as const).map(field)}
      <p>State prerequisites, owners, quality requirements, stop conditions and completion evidence. Use confirmed rules. Mark missing owners or policy as unresolved and pause affected actions.</p>
      <label>CLEARER AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Sanitized CLEARER request copied. Verify the document against actual practice.')}>Copy CLEARER AI request</button></div>
    <div><h3>3. Walk through the normal path and exception</h3>{(['normalInput', 'normalActual', 'exceptionInput', 'exceptionActual'] as const).map(field)}
      <p>Ask someone unfamiliar with the work when appropriate, or perform a careful walkthrough. Set expectations first, then retain actual results. Missing approval means stop before sending, keep unsent and refer to the confirmed reviewer.</p></div>
    <div><h3>4. Correct, retest and decide</h3>{(['corrections', 'retest', 'decision', 'completion'] as const).map(field)}
      <p>Correct every material instruction requiring guessing. Keep before and after, actual retest results or explicit pending action. This exercise does not establish organizational policy or permission for live sending.</p>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I reviewed the chosen format, all seven CLEARER parts, actual normal and exception walkthrough evidence, corrections, retest status, policy gaps and my human decision.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save CLEARER guidance to My Project Record'}</button>
        : <p>Copy your work to keep it. Saving to My Project Record requires an active enrollment.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 5.3 operating evidence copied.')}>Copy my Lesson 5.3 record</button>
      <details><summary>Read or copy my operating record</summary><textarea aria-label="Lesson 5.3 operating record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your document and human decision are ready to save.' : 'Complete the document, both walkthroughs, corrections and human decision before saving.')}</p>
      <p>Keep the connected Journey Five workbook and carry the same project into Lesson 5.4. Earlier project work is preserved.</p>
    </div>
  </section>
}
