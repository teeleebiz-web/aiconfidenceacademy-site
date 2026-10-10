import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  context: 'Continuing project and bounded purpose',
  listening: 'Listening carry-forward — simulated evidence stays simulated',
  confirmed: 'Confirmed facts and approval boundaries',
  expected: 'Expected benefits to examine — no guarantees',
  open: 'Open questions and undecided matters',
  responsible: 'Human review, support owner and feedback route',
  voice: 'Organizational voice and tone to preserve',
  sources: 'Verified commitments — approved source, source date and actual check date',
  baseMessage: 'Base change message',
  managerMessage: 'Manager audience adaptation',
  participantMessage: 'Participant audience adaptation',
  reassuranceBefore: 'Unsupported reassurance or pressure before correction',
  reassuranceAfter: 'Correction with a specific action, owner and honest limit',
  clearFindings: 'Existing CLEAR review — findings and revisions',
  finalMessage: 'Final reviewed change message',
  approvalReference: 'Human approval owner and reference — if approval has been given',
  decisionNote: 'Most important communication correction and why it matters',
} as const
type Draft = Record<keyof typeof fields, string>
type Audience = 'manager' | 'participant'
type Approval = 'pending_human_review' | 'approved_reported_by_learner'
type SavedMessage = { draft?: Partial<Draft>; selected_audience?: Audience; approval_status?: Approval }
const blank = () => Object.fromEntries(Object.keys(fields).map(key => [key, ''])) as Draft

export function PhaseTwoChangeMessagePractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
  const [draft, setDraft] = useState<Draft>(blank)
  const [audience, setAudience] = useState<Audience>('participant')
  const [approval, setApproval] = useState<Approval>('pending_human_review')
  const [reviewChecked, setReviewChecked] = useState(false)
  const [project, setProject] = useState<{ path: PhaseTwoProjectPath; title: string } | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setProject(null); setDraft(blank()); setAudience('participant'); setApproval('pending_human_review'); setReviewChecked(false); setStatus('')
    if (!enrollmentId) return
    let active = true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active || !record) return
      setProject({ path: record.project_path, title: record.project_title })
      const plan = record.sections.leadership_and_adoption_plan as {
        change_message_lesson_3_3?: SavedMessage;
        listening_lesson_3_2?: { draft?: { context?: string; revisedSummary?: string; supportAction?: string; supportOwner?: string; reviewLimit?: string } }
      } | undefined
      const saved = plan?.change_message_lesson_3_3
      if (saved?.draft) {
        setDraft(Object.fromEntries(Object.keys(fields).map(key => [key, typeof saved.draft?.[key as keyof Draft] === 'string' ? saved.draft[key as keyof Draft] : ''])) as Draft)
        setAudience(saved.selected_audience === 'manager' ? 'manager' : 'participant')
        setApproval(saved.approval_status === 'approved_reported_by_learner' ? 'approved_reported_by_learner' : 'pending_human_review')
      } else {
        const prior = plan?.listening_lesson_3_2?.draft
        setDraft(old => ({ ...old,
          context: [record.project_title, prior?.context].filter(Boolean).join('\n'),
          listening: prior ? ['SIMULATED REHEARSAL — not actual staff feedback or approval.', prior.revisedSummary,
            prior.supportAction && 'Proposed support: ' + prior.supportAction,
            prior.supportOwner && 'Proposed owner: ' + prior.supportOwner,
            prior.reviewLimit && 'Needs review: ' + prior.reviewLimit].filter(Boolean).join('\n') : '',
        }))
      }
    }).catch(() => { if (active) setStatus('Your Project Record could not load. You can still copy your work.') })
    return () => { active = false }
  }, [enrollmentId])
  const inputs = ['Context: ' + draft.context, 'Voice: ' + draft.voice, 'Confirmed: ' + draft.confirmed,
    'Expected: ' + draft.expected, 'Open: ' + draft.open, 'Responsible: ' + draft.responsible,
    'Sources and checks: ' + draft.sources, 'Also adapt for a manager and a participant.'].join('\n')
  const request = approvedAiRequest.replace('[facts]', inputs)
  const complete = Object.entries(draft).every(([key, value]) => key === 'listening' || key === 'approvalReference' || value.trim()) &&
    (approval === 'pending_human_review' || !!draft.approvalReference.trim()) && reviewChecked
  const evidence = {
    lesson: '3.3', draft, selected_audience: audience,
    final_message: draft.finalMessage,
    selected_audience_adaptation: audience === 'manager' ? draft.managerMessage : draft.participantMessage,
    approval_status: approval,
    approval_reference: approval === 'approved_reported_by_learner' ? draft.approvalReference : null,
    ai_request: request, review_framework: 'CLEAR', learner_review_confirmed: reviewChecked,
    listening_carry_forward_is_simulated: true,
  }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(key: keyof Draft) {
    return <label key={key}>{fields[key]}<textarea rows={key.endsWith('Message') || key === 'listening' ? 5 : 3} value={draft[key]} onChange={e => setDraft(old => ({ ...old, [key]: e.target.value }))} /></label>
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
        patch: { leadership_and_adoption_plan: { change_message_lesson_3_3: evidence } }, decisionNote: 'Lesson 3.3 — ' + draft.decisionNote })
      setStatus('Saved to your continuing Project Record. Version ' + result.saved_version + '. Approval status: ' + (approval === 'pending_human_review' ? 'pending human review.' : 'approval reported by you with a human reference.'))
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-change-message-heading">
    <header><p className="eyebrow">Journey Three · Evidence · Voice · Responsibility</p>
      <h2 id="p2-change-message-heading">Prepare a change message with evidence</h2>
      <p>Continue the same bounded project. Use fictional or authorized, sanitized inputs. A simulated listening concern can inform a question; it cannot establish actual staff agreement or approval.</p>
    </header>
    <div><h3>1. Sort the evidence and preserve your voice</h3>
      {(['context', 'listening', 'confirmed', 'expected', 'open', 'responsible', 'voice', 'sources'] as const).map(field)}
      <p>Distinguish a proposed pilot from an approved pilot and a wider rollout. Verify the reviewer, support commitments and question route with their human owners. Record the date you actually checked each important source.</p>
    </div>
    <div><h3>2. Draft and adapt for two audiences</h3>
      <label>Change-message AI request<textarea readOnly rows={9} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Change-message request copied. Check every claim and preserve the approval boundary.')}>Copy change-message request</button>
      {(['baseMessage', 'managerMessage', 'participantMessage'] as const).map(field)}
      <p>Use the same facts, uncertainty and human control in each version. The manager needs decision evidence; the participant needs clear actions, support and a way to ask questions.</p>
    </div>
    <div><h3>3. Use your existing CLEAR review</h3>
      <p>Correct: facts and instructions. Listener: audience fit. Enough: gaps and repetition. Appropriate: tone and setting. Responsible: privacy, fairness, risk, authority and accountability.</p>
      <p>Review personally, then use AI critique as additional input. Verify important claims with approved sources. Record one summary of the existing CLEAR findings below.</p>
      {(['reassuranceBefore', 'reassuranceAfter', 'clearFindings', 'finalMessage'] as const).map(field)}
      <label>Audience adaptation to retain<select value={audience} onChange={e => setAudience(e.target.value as Audience)}><option value="participant">Participant adaptation</option><option value="manager">Manager adaptation</option></select></label>
    </div>
    <div><h3>4. Retain the actual approval status</h3>
      <label>Human approval status<select value={approval} onChange={e => setApproval(e.target.value as Approval)}><option value="pending_human_review">Pending human review — save as draft</option><option value="approved_reported_by_learner">Human approval given — record its owner and reference</option></select></label>
      {field('approvalReference')}{field('decisionNote')}
      <p>Pending approval remains visible. AI wording, this practice and saving a record cannot authorize a pilot or rollout.</p>
      <label><input type="checkbox" checked={reviewChecked} onChange={e => setReviewChecked(e.target.checked)} />I applied the existing CLEAR review, checked commitments and authority, removed unauthorized or personal information and retained honest evidence and approval limits.</label>
    </div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : approval === 'pending_human_review' ? 'Save change-message draft to My Project Record' : 'Save reviewed change message to My Project Record'}</button> : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 3.3 change-message section copied with its approval status.')}>Copy my Lesson 3.3 record</button>
      <details><summary>Read or copy my change-message section</summary><textarea aria-label="Lesson 3.3 change-message record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your message and selected adaptation are ready to save with the stated approval status.' : 'Complete the evidence brief, messages, CLEAR findings, claim correction and human review check before saving.')}</p>
      <p>Saving preserves earlier adoption-plan work. Carry the message, selected adaptation and open questions into Lesson 3.4.</p>
    </div>
  </section>
}
