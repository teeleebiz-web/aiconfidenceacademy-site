import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "projectContext": "Continuing project and privacy-safe evidence index",
  "capability1": "Capability 1: statement, supported verb, evidence reference, check and limit",
  "capability2": "Capability 2: statement, supported verb, evidence reference, check and limit",
  "capability3": "Capability 3: statement, supported verb, evidence reference, check and limit",
  "capability4": "Capability 4: statement, supported verb, evidence reference, check and limit",
  "capability5": "Capability 5: statement, supported verb, evidence reference, check and limit",
  "capability6": "Capability 6: statement, supported verb, evidence reference, check and limit",
  "capability7": "Capability 7: statement, supported verb, evidence reference, check and limit",
  "capability8": "Capability 8: statement, supported verb, evidence reference, check and limit",
  "capability9": "Capability 9: statement, supported verb, evidence reference, check and limit",
  "capability10": "Capability 10: statement, supported verb, evidence reference, check and limit",
  "value1": "Value Connection 1: capability, context, people, improvement and evidence",
  "value2": "Value Connection 2: capability, context, people, improvement and evidence",
  "value3": "Value Connection 3: capability, context, people, improvement and evidence",
  "selection": "Two selected connections and why their evidence is strongest",
  "story": "Evidence Story: context, purpose, action, AI role, human judgment, result and limit",
  "privacy": "Privacy review and accurate fictional, sanitized or recreated labels",
  "demonstration": "Professional explanation: capability, shown work and claim limit",
  "remaining": "Unsupported statements removed and evidence still pending"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoCapabilityPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.professional_positioning_evidence as { capability_lesson_6_1?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.capability_lesson_6_1?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Use privacy-safe references to the same retained course work.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[index]', draft.projectContext || '[Add a privacy-safe index of retained work]')
  const inventory = Array.from({ length: 10 }, (_, i) => ({ number: i + 1, statement_evidence_check_limit: draft[('capability' + (i + 1)) as keyof Draft] }))
  const evidence = { lesson: '6.1', draft, evidence_index: draft.projectContext, capability_inventory: inventory,
    value_connections: [draft.value1, draft.value2, draft.value3], two_selected_and_reasons: draft.selection,
    evidence_story: draft.story, privacy_and_example_labels: draft.privacy, professional_demonstration_and_limit: draft.demonstration,
    removed_claims_and_pending_evidence: draft.remaining, human_review_confirmed: checked, ai_request: request,
    grants_professional_title: false, grants_authority: false }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['story', 'demonstration'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { professional_positioning_evidence: { capability_lesson_6_1: evidence } }, decisionNote: 'Lesson 6.1 — ' + draft.demonstration })
      setStatus('Professional Positioning Evidence saved to your continuing Project Record. Version ' + result.saved_version + '. Keep actual evidence, decisions and unresolved limits visible.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-capability-title">
    <header><p className="eyebrow">Demonstrated capability • Practical value • Evidence</p>
      <h2 id="p2-capability-title">Build Professional Positioning Evidence</h2>
      <p>Use the same project and retained work. Each capability needs a supported verb, evidence, a check and a limit. Keep unsupported entries pending until you can demonstrate them.</p></header>
    <div><h3>1. Bring forward your evidence</h3>{field('projectContext')}
      <label>Capability inventory AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Privacy-safe inventory request copied. Check every suggested statement against your work.')}>Copy capability inventory AI request</button></div>
    <div><h3>2. Verify ten capabilities</h3>
      <p>Use Explain, Do, Review, Improve and Show where supported. For each entry, name the statement, verb, artifact reference, human check and honest limit. Do not add a title, measured saving or result that your work does not establish.</p>
      {Array.from({ length: 10 }, (_, i) => field(('capability' + (i + 1)) as keyof Draft))}</div>
    <div><h3>3. Develop three connections and select two</h3>{(['value1', 'value2', 'value3', 'selection'] as const).map(field)}
      <p>Use capability, context, people, improvement and evidence. State whether a benefit was observed or remains proposed. Name the two selected connections and why their evidence is strongest.</p></div>
    <div><h3>4. Tell the story and show the work</h3>{(['story', 'privacy', 'demonstration', 'remaining'] as const).map(field)}
      <p>Explain one capability in a professional context and show its supporting work. Identify your contribution, the AI role and the limit. Remove private details and label fictional, sanitized or recreated examples accurately.</p>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I checked all ten capability entries, supporting work and limits, the two selected connections, privacy-safe Evidence Story and professional demonstration. Pending evidence is visible.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Professional Positioning Evidence to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 6.1 capability evidence copied.')}>Copy my Lesson 6.1 record</button>
      <details><summary>Read or copy my capability evidence</summary><textarea aria-label="Lesson 6.1 capability record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your positioning evidence and human review are ready to save.' : 'Complete the inventory, connections, story, evidence checks and demonstration before saving.')}</p>
      <p>Complete the connected Journey Six workbook. Carry the same project and missing evidence into Lesson 6.2 — Finish the Artifact with Evidence and Revision. Earlier project work is preserved.</p>
    </div>
  </section>
}
