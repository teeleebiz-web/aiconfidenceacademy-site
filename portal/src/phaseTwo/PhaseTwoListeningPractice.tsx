import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  context: 'Continuing project, affected role and concern from Lesson 3.1',
  priorMap: 'People map and unresolved questions carried from Lesson 3.1',
  rolePlay: 'Simulated task-level role-play exchange — omit personal disclosures',
  initialSummary: 'First listening summary',
  understandingCheck: 'Question that tests your understanding',
  simulatedReply: 'Simulated reply, correction or confirmation — not real feedback',
  revisedSummary: 'Revised listening summary after the understanding check',
  lowRiskGoal: 'Low-risk goal for reflective guidance',
  questionBefore: 'Question that pressures or oversteps — before correction',
  questionAfter: 'Revised question that preserves agency',
  revisionReason: 'Why the question needed correction',
  responseChoices: 'When to provide instruction, offer advice, ask a question or refer to qualified support',
  disagreementResponse: 'Response to disagreement without minimizing the concern',
  supportAction: 'One practical support action',
  supportOwner: 'Accountable human owner or role',
  reviewLimit: 'What can be addressed now and what needs review',
  decisionNote: 'Most important listening correction and why it matters',
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(key => [key, ''])) as Draft
const listeningLabels = ['Learn the role', 'Invite a concern', 'Invite what might become harder', 'Test your summary', 'Explore support']
const reflectiveLabels = ['Clarify', 'Explore', 'Examine', 'Choose', 'Act', 'Review']
type SavedListening = { draft?: Partial<Draft>; listening_questions?: string[]; reflective_questions?: string[] }
function questions(value: unknown, count: number) {
  return Array.from({ length: count }, (_, i) => Array.isArray(value) && typeof value[i] === 'string' ? value[i] : '')
}

export function PhaseTwoListeningPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
  const [draft, setDraft] = useState<Draft>(blank)
  const [listening, setListening] = useState<string[]>(() => questions(null, 5))
  const [reflective, setReflective] = useState<string[]>(() => questions(null, 6))
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [project, setProject] = useState<{ path: PhaseTwoProjectPath; title: string } | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setProject(null); setDraft(blank()); setListening(questions(null, 5)); setReflective(questions(null, 6)); setPrivacyChecked(false); setStatus('')
    if (!enrollmentId) return
    let active = true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active || !record) return
      setProject({ path: record.project_path, title: record.project_title })
      const plan = record.sections.leadership_and_adoption_plan as {
        listening_lesson_3_2?: SavedListening;
        people_lesson_3_1?: { draft?: { context?: string; groups?: string; openQuestions?: string; designAfter?: string }; concerns?: unknown[] }
      } | undefined
      const saved = plan?.listening_lesson_3_2
      if (saved?.draft) {
        setDraft(Object.fromEntries(Object.keys(fields).map(key => [key, typeof saved.draft?.[key as keyof Draft] === 'string' ? saved.draft[key as keyof Draft] : ''])) as Draft)
        setListening(questions(saved.listening_questions, 5)); setReflective(questions(saved.reflective_questions, 6))
      } else {
        const people = plan?.people_lesson_3_1
        setDraft(old => ({ ...old,
          context: [record.project_title, people?.draft?.context, people?.draft?.designAfter].filter(Boolean).join('\n'),
          priorMap: [people?.draft?.groups, people?.draft?.openQuestions && 'Open questions: ' + people.draft.openQuestions,
            people?.concerns?.length && 'Earlier concern map: ' + JSON.stringify(people.concerns, null, 2)].filter(Boolean).join('\n'),
        }))
      }
    }).catch(() => { if (active) setStatus('Your Project Record could not load. You can still copy your work.') })
    return () => { active = false }
  }, [enrollmentId])
  const request = approvedAiRequest.replace('[brief]', draft.context.trim() || '[brief]')
  const complete = Object.entries(draft).every(([key, value]) => key === 'priorMap' || value.trim()) &&
    listening.every(value => value.trim()) && reflective.every(value => value.trim()) && privacyChecked
  const evidence = {
    lesson: '3.2', evidence_type: 'simulated_role_play', represents_real_staff: false,
    draft, listening_questions: listening, concern_invitation_questions: [2, 3],
    reflective_questions: reflective, reflective_steps: reflectiveLabels.map(label => label.toLowerCase()),
    role_play_request: request, personal_disclosures_removed_by_learner: privacyChecked,
    support_status: 'proposed_for_human_review',
  }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(key: keyof Draft) {
    return <label key={key}>{fields[key]}<textarea rows={key === 'priorMap' || key === 'rolePlay' ? 5 : 3} value={draft[key]} onChange={e => setDraft(old => ({ ...old, [key]: e.target.value }))} /></label>
  }
  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); setStatus(message) }
    catch { setStatus('Clipboard is unavailable. Select the request or record text below to copy it.') }
  }
  async function save() {
    if (!enrollmentId || !project || !complete || saving) return
    setSaving(true)
    try {
      const result = await savePhaseTwoProjectUpdate({ enrollmentId, path: project.path, title: project.title,
        patch: { leadership_and_adoption_plan: { listening_lesson_3_2: evidence } }, decisionNote: 'Lesson 3.2 — ' + draft.decisionNote })
      setStatus('Saved to your continuing Project Record. Version ' + result.saved_version + '.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-listening-heading">
    <header><p className="eyebrow">Journey Three · Listening · Choice · Support</p>
      <h2 id="p2-listening-heading">Practice a listening conversation</h2>
      <p>Continue your people map and bounded project. This practice is a simulated role-play; it does not represent real staff or establish agreement. Use fictional or authorized, sanitized context and omit personal disclosures.</p>
    </header>
    <div><h3>1. Bring forward the people map and write five questions</h3>{field('context')}{field('priorMap')}
      <p>LISTEN: learn the role, invite the concern, summarize, test your understanding, explore support and name what can be addressed or needs review.</p>
      {listeningLabels.map((label, i) => <label key={label}>Listening question {i + 1} — {label}<textarea rows={2} value={listening[i]} onChange={e => setListening(old => old.map((item, n) => n === i ? e.target.value : item))} /></label>)}
      <p>Questions 2 and 3 directly invite concerns. Ask one question at a time without assuming the answer.</p>
    </div>
    <div><h3>2. Rehearse, summarize and test understanding</h3>
      <label>Simulated role-play request<textarea readOnly rows={6} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Role-play request copied. Keep the rehearsal simulated and review the response yourself.')}>Copy role-play request</button>
      {(['rolePlay', 'initialSummary', 'understandingCheck', 'simulatedReply', 'revisedSummary'] as const).map(field)}
      <p>Retain the task-level exchange and any correction. A simulated confirmation only checks your summary within the rehearsal.</p>
    </div>
    <div><h3>3. Use six reflective questions and remove pressure</h3>{field('lowRiskGoal')}
      {reflectiveLabels.map((label, i) => <label key={label}>{label} — reflective question<textarea rows={2} value={reflective[i]} onChange={e => setReflective(old => old.map((item, n) => n === i ? e.target.value : item))} /></label>)}
      {(['questionBefore', 'questionAfter', 'revisionReason'] as const).map(field)}
      <p>Help the person examine options and choose. Required procedures and approval limits stay explicit.</p>
    </div>
    <div><h3>4. Choose the response and name accountable support</h3>
      {(['responseChoices', 'disagreementResponse', 'supportAction', 'supportOwner', 'reviewLimit', 'decisionNote'] as const).map(field)}
      <p>Give verified instruction when needed. Offer advice as an option, ask questions to expand thinking and use the appropriate qualified support route for sensitive needs beyond your competence.</p>
      <label><input type="checkbox" checked={privacyChecked} onChange={e => setPrivacyChecked(e.target.checked)} />I checked that this shared record contains no personal disclosures and clearly labels the role-play simulated.</label>
    </div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save listening section to My Project Record'}</button> : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 3.2 simulated listening section copied.')}>Copy my Lesson 3.2 record</button>
      <details><summary>Read or copy my listening section</summary><textarea aria-label="Lesson 3.2 listening record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your simulated listening section is ready to save for human review.' : 'Complete five listening questions, six reflective questions, the summary check, revised question, support action and privacy review before saving.')}</p>
      <p>Saving preserves your Lesson 3.1 people map. It does not confirm staff agreement, approve deployment or mark the lesson complete. Carry the summary and open decisions into Lesson 3.3.</p>
    </div>
  </section>
}
