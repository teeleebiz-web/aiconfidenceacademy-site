import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "projectContext": "Continuing capstone, reviewed version, audience, and evidence references",
  "situation": "Situation: need, context, and affected people \u2014 planned time",
  "target": "Target: intended bounded result and success criterion \u2014 planned time",
  "operations": "Operations: normal request, review exception, AI support, and human decisions \u2014 planned time",
  "result": "Result: supported tests, before/after change, references, and limits \u2014 planned time",
  "judgment": "Your judgment: personal decision, remaining limit, and next check \u2014 planned time",
  "cueSheet": "One-page cue sheet: STORY reminders, time, visual action, and evidence",
  "visualSequence": "Simple visual sequence or live demonstration, exact version, and safe fallback",
  "shareCheck": "Actual sharing check: privacy, permission, readable meaning, and displayed material",
  "rehearsal": "First rehearsal: actual total time, difficult moment, and observation",
  "aiReview": "AI practice-review questions inspected and accepted or rejected with reasons",
  "questions": "Three likely questions and your own answers: assumptions, tests, costs, people, and failure",
  "revision": "Weakest-section revision and actual new rehearsal observation",
  "delivery": "Actual five-to-seven-minute delivery: time, presentation reference, own explanation, and limits",
  "evidenceIndex": "Saved presentation, cue sheet, visual order, and question-response notes"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoDemonstrationPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.capstone_integration_package as { story_demonstration_lesson_6_4?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.story_demonstration_lesson_6_4?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Use privacy-safe references to the same retained course work.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const complete = Object.values(draft).every(v => v.trim()) && checked
  const request = approvedAiRequest.replace('[draft]', [draft.projectContext, draft.situation, draft.target, draft.operations, draft.result, draft.judgment].filter(Boolean).join('\n') || '[Add the privacy-safe STORY outline and evidence references]')
  const evidence = { lesson: '6.4', draft, story_outline: { situation: draft.situation, target: draft.target,
    operations: draft.operations, result: draft.result, your_judgment: draft.judgment }, cue_sheet: draft.cueSheet,
    visual_sequence: draft.visualSequence, sharing_check: draft.shareCheck, first_rehearsal: draft.rehearsal,
    inspected_ai_questions: draft.aiReview, own_question_response_notes: draft.questions,
    weakest_section_revision_and_rehearsal: draft.revision, actual_delivery_and_timing: draft.delivery,
    evidence_index: draft.evidenceIndex, human_review_confirmed: checked, ai_request: request,
    ai_answers_on_behalf: false, assigns_certification: false }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['cueSheet','questions','delivery'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { capstone_integration_package: { story_demonstration_lesson_6_4: evidence } }, decisionNote: 'Lesson 6.4 — ' + draft.judgment })
      setStatus('STORY demonstration and question-response notes saved to your continuing Project Record. Version ' + result.saved_version + '. Keep actual evidence, decisions and unresolved limits visible.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-demonstration-title">
    <header><p className="eyebrow">STORY Presentation Path • Evidence • Your judgment</p>
      <h2 id="p2-demonstration-title">Demonstrate your project with STORY</h2>
      <p>Prepare and deliver a five-to-seven-minute explanation of the same reviewed project. Show the normal path, an exception requiring review, AI support, human decisions, supported results, and honest limits.</p></header>
    <div><h3>1. Create the timed STORY outline</h3>{(['projectContext','situation','target','operations','result','judgment'] as const).map(field)}
      <label>STORY outline AI review request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Privacy-safe STORY review request copied. AI asks questions; you answer for the work.')}>Copy STORY outline AI review request</button></div>
    <div><h3>2. Prepare a cue sheet and safe visuals</h3>{(['cueSheet','visualSequence','shareCheck'] as const).map(field)}
      <p>Keep the cue sheet to one page of useful reminders. Check every displayed item for privacy, permission, readable meaning, and the correct version.</p></div>
    <div><h3>3. Rehearse, prepare answers, and revise</h3>{(['rehearsal','aiReview','questions','revision'] as const).map(field)}
      <p>Record actual times and difficult moments. Prepare three own-word answers covering assumptions, testing, costs, affected people, and failure. Revise and rehearse the weakest section.</p></div>
    <div><h3>4. Deliver and save the demonstration</h3>{(['delivery','evidenceIndex'] as const).map(field)}
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I checked sharing safety, evidence support, actual five-to-seven-minute delivery, rehearsal changes, and my own answers about why the work matters, tests, changes, and limits.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save STORY Demonstration and Questions to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 6.4 demonstration record copied.')}>Copy my Lesson 6.4 record</button>
      <details><summary>Read or copy my demonstration record</summary><textarea aria-label="Lesson 6.4 demonstration record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your demonstration and question-response notes are ready to save.' : 'Complete the outline, cue sheet, visuals, sharing check, rehearsals, own answers, and actual delivery before saving.')}</p>
      <p>Complete the connected Journey Six workbook. Carry the supported explanation into Lesson 6.5 — Position the Work and Choose the Next Opportunity. Earlier project evidence is preserved.</p>
    </div>
  </section>
}
