import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "projectContext": "Continuing project, current version, intended audience, and safe references",
  "inventory": "Verified inventory: artifact, human decisions, AI assistance, tests, revisions, and limits",
  "introduction": "75-word professional introduction using only supported truth",
  "profile": "40-word profile with the same contribution and relevant limit",
  "bullets": "Three evidence-based bullets \u2014 one supported bullet per line",
  "spoken": "Short spoken introduction in your own voice and actual rehearsal observation",
  "truthTest": "Truth Test for claims: demonstrate, explain, support wording, and provide evidence",
  "currentRole": "Current-role or current-setting map: opportunity, fit, evidence, gap, people, next step",
  "adjacent": "Adjacent-opportunity map: opportunity, fit, evidence, gap, people, next step",
  "longerTerm": "Longer-term possibility map: opportunity, fit, evidence, gap, people, next step",
  "choice": "Primary opportunity, meaningful backup, and reasons for both",
  "gap": "Gap to address before pursuing the selected opportunity",
  "action": "Specific thirty-day action: owner, permission, boundary, evidence, and checkpoint",
  "boundaries": "Boundaries, unknowns, and backup condition if permission or support is unavailable",
  "aiReview": "AI wording inspected: accepted, changed, or rejected with reasons",
  "claimCorrection": "Inflated claim, evidence-based correction, and own explanation of the gap",
  "evidenceIndex": "Saved language set, Opportunity Map, boundaries, next action, and evidence references"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft

export function PhaseTwoOpportunityPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.professional_positioning_evidence as { positioning_lesson_6_5?: { draft?: Partial<Draft> } } | undefined
      const saved = section?.positioning_lesson_6_5?.draft
      if (saved) setDraft(Object.fromEntries(Object.keys(fields).map(k => [k, typeof saved[k as keyof Draft] === 'string' ? saved[k as keyof Draft] : ''])) as Draft)
      else setDraft(old => ({ ...old, projectContext: record.project_title + ' — Path ' + record.project_path + '. Use privacy-safe references to the same retained course work.' }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. Your practice can still be copied.') })
    return () => { active = false }
  }, [enrollmentId])
  const wordCount = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0
  const bulletCount = draft.bullets.split('\n').filter(line => line.trim()).length
  const languageComplete = wordCount(draft.introduction) === 75 && wordCount(draft.profile) === 40 && bulletCount === 3
  const complete = Object.values(draft).every(v => v.trim()) && languageComplete && checked
  const request = approvedAiRequest.replace('[notes]', [draft.projectContext, draft.inventory, draft.truthTest, draft.currentRole, draft.adjacent, draft.longerTerm].filter(Boolean).join('\n') || '[Add the privacy-safe verified inventory and opportunity notes]')
  const evidence = { lesson: '6.5', draft, language_set: { introduction: draft.introduction, profile: draft.profile,
    bullets: draft.bullets.split('\n').filter(line => line.trim()), spoken_version_and_rehearsal: draft.spoken },
    verified_inventory: draft.inventory, truth_test: draft.truthTest,
    opportunity_map: { current_role_or_setting: draft.currentRole, adjacent: draft.adjacent, longer_term: draft.longerTerm },
    primary_backup_and_reasons: draft.choice, gap_to_address: draft.gap, thirty_day_evidence_action: draft.action,
    boundaries_and_backup_condition: draft.boundaries, inspected_ai_wording: draft.aiReview,
    inflated_claim_correction_and_gap_explanation: draft.claimCorrection, evidence_index: draft.evidenceIndex,
    human_review_confirmed: checked, ai_request: request, assigns_certification: false,
    word_counts: { introduction: wordCount(draft.introduction), profile: wordCount(draft.profile) } }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(k: keyof Draft) {
    return <label key={k}>{fields[k]}<textarea rows={['introduction','currentRole','adjacent','longerTerm','claimCorrection'].includes(k) ? 5 : 3} value={draft[k]}
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
        patch: { professional_positioning_evidence: { positioning_lesson_6_5: evidence } }, decisionNote: 'Lesson 6.5 — ' + draft.choice })
      setStatus('Positioning language, Opportunity Map, and next action saved to your continuing Project Record. Version ' + result.saved_version + '. Keep actual evidence, decisions and unresolved limits visible.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-opportunity-title">
    <header><p className="eyebrow">Truth Test • Opportunity Map • Evidence-building action</p>
      <h2 id="p2-opportunity-title">Position your work with supported truth</h2>
      <p>Describe the same verified work in four formats. Compare a current-role or current-setting opportunity, an adjacent contribution, and a longer-term possibility without inventing credentials or guaranteeing outcomes.</p></header>
    <div><h3>1. Open the inventory and draft four formats</h3>{(['projectContext','inventory','introduction','profile','bullets','spoken','truthTest'] as const).map(field)}
      <p aria-live="polite">Introduction: {wordCount(draft.introduction)} / 75 words. Profile: {wordCount(draft.profile)} / 40 words. Bullets: {bulletCount} / 3 nonempty lines.</p>
      <label>Verified positioning AI request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Privacy-safe positioning request copied. Inspect every claim and preserve your voice.')}>Copy verified positioning AI request</button>{field('aiReview')}</div>
    <div><h3>2. Compare three opportunities</h3>{(['currentRole','adjacent','longerTerm'] as const).map(field)}
      <p>Use opportunity, fit, evidence, gap, people, and next step for every option. Record actual roles and permissions; keep untested capability and unknown costs visible.</p></div>
    <div><h3>3. Choose and build the missing evidence</h3>{(['choice','gap','action','boundaries'] as const).map(field)}
      <p>Name a primary and meaningful backup. Define one specific thirty-day action with owner, permission, boundary, retained evidence, and checkpoint.</p></div>
    <div><h3>4. Correct, explain, and save</h3>{(['claimCorrection','evidenceIndex'] as const).map(field)}
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I applied the Truth Test to every claim, checked all four formats and three opportunities, and verified the correction, selected gap, boundaries, and realistic thirty-day action.</label></div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Positioning Language and Opportunity Map to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 6.5 positioning record copied.')}>Copy my Lesson 6.5 record</button>
      <details><summary>Read or copy my positioning record</summary><textarea aria-label="Lesson 6.5 positioning record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your supported language, map, and next action are ready to save.' : 'Complete every field, exactly 75 and 40 words, three bullet lines, and human review before saving.')}</p>
      <p>Complete the connected Journey Six workbook. Carry the supported language and next action into Lesson 6.6 — Submit the Portfolio and Execution Plan. Earlier positioning and project evidence is preserved.</p>
    </div>
  </section>
}
