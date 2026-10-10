import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  context: 'Continuing project scope, intended result and Journey Two evidence references',
  lens: 'Purpose, people, participation, support and responsibility — five-part review',
  groups: 'Affected groups — perform, receive, approve and support; benefit, extra effort and influence',
  aiOutput: 'Exact AI response retained for review',
  aiReview: 'AI suggestions accepted, revised or rejected — assumptions, omissions and reasons',
  perspective: 'Least-powerful perspective — access, dignity and correction needs',
  designBefore: 'Original proposed design decision',
  designAfter: 'Revised design decision — reason, evidence status and approval still needed',
  decisionNote: 'Most important people-first design decision and why it changed',
  openQuestions: 'Unresolved questions, accountable owners and next steps',
} as const
type Draft = Record<keyof typeof fields, string>
type Concern = { group: string; question: string; evidenceStatus: 'anticipated' | 'observed' | 'reported'; source: string; benefitEffort: string; route: string; participation: string; support: string; owner: string }
const emptyConcern = (): Concern => ({ group: '', question: '', evidenceStatus: 'anticipated', source: '', benefitEffort: '', route: '', participation: '', support: '', owner: '' })
const blank = () => Object.fromEntries(Object.keys(fields).map(key => [key, ''])) as Draft
const concernLabels: Record<Exclude<keyof Concern, 'evidenceStatus'>, string> = {
  group: 'Affected group and role', question: 'Question or concern', source: 'Source, observation or next question to investigate',
  benefitEffort: 'Benefit and additional effort', route: 'Response needed — facts, listening and/or leadership approval',
  participation: 'Participation opportunity and response back', support: 'Practical support', owner: 'Accountable human owner or role',
}
function validConcern(c: Concern) {
  return Object.entries(c).every(([key, value]) => key === 'source' && c.evidenceStatus === 'anticipated' || value.trim().length > 0)
}
export function PhaseTwoPeoplePractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
  const [draft, setDraft] = useState<Draft>(blank)
  const [concerns, setConcerns] = useState<Concern[]>(() => Array.from({ length: 5 }, emptyConcern))
  const [project, setProject] = useState<{ path: PhaseTwoProjectPath; title: string } | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setProject(null); setDraft(blank()); setConcerns(Array.from({ length: 5 }, emptyConcern)); setStatus('')
    if (!enrollmentId) return
    let active = true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active || !record) return
      setProject({ path: record.project_path, title: record.project_title })
      const people = record.sections.leadership_and_adoption_plan as { people_lesson_3_1?: { draft?: Partial<Draft>; concerns?: Partial<Concern>[] } } | undefined
      const prior = people?.people_lesson_3_1
      if (prior?.draft) setDraft(Object.fromEntries(Object.keys(fields).map(key => [key, typeof prior.draft?.[key as keyof Draft] === 'string' ? prior.draft[key as keyof Draft] : ''])) as Draft)
      else {
        const solution = record.sections.ai_solution_concept as { exception_tests_lesson_2_6?: { draft?: { scope?: string; updatedConcept?: string; updatedMap?: string; limits?: string } } } | undefined
        const earlier = solution?.exception_tests_lesson_2_6?.draft
        setDraft(old => ({ ...old, context: [record.project_title, earlier?.scope, earlier?.updatedConcept && 'Solution concept: ' + earlier.updatedConcept, earlier?.updatedMap && 'Tested workflow: ' + earlier.updatedMap].filter(Boolean).join('\n'), openQuestions: earlier?.limits || '' }))
      }
      if (prior?.concerns) setConcerns(Array.from({ length: Math.max(5, prior.concerns.length) }, (_, i) => {
        const value = prior.concerns![i]
        const item = emptyConcern()
        for (const key of Object.keys(item) as Array<keyof Concern>) {
          if (key !== 'evidenceStatus' && typeof value?.[key] === 'string') item[key] = value[key]
        }
        if (value?.evidenceStatus === 'observed' || value?.evidenceStatus === 'reported') item.evidenceStatus = value.evidenceStatus
        return item
      }))
    }).catch(() => { if (active) setStatus('Your Project Record could not load. You can still copy your work.') })
    return () => { active = false }
  }, [enrollmentId])
  const request = approvedAiRequest.replace('[project context]', draft.context.trim() || '[project context]')
  const complete = Object.values(draft).every(value => value.trim()) && concerns.length >= 5 && concerns.every(validConcern)
  const evidence = { lesson: '3.1', draft, concerns, people_mapping_request: request, design_status: 'proposed_for_human_review', evidence_reported_by_learner: true }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(key: keyof Draft) {
    return <label key={key}>{fields[key]}<textarea rows={key === 'groups' || key === 'aiOutput' ? 5 : 3} value={draft[key]} onChange={e => setDraft(old => ({ ...old, [key]: e.target.value }))} /></label>
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
        patch: { leadership_and_adoption_plan: { people_lesson_3_1: evidence } }, decisionNote: 'Lesson 3.1 — ' + draft.decisionNote })
      setStatus('Saved to your continuing Project Record. Version ' + result.saved_version + '.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-people-heading">
    <header><p className="eyebrow">Journey Three · People · Participation · Responsibility</p>
      <h2 id="p2-people-heading">Build the people section of your adoption plan</h2>
      <p>Continue your bounded project and Journey Two evidence. Use fictional or authorized context in your own AI assistant. Keep supplied evidence separate from possible concerns and retain human approval.</p>
    </header>
    <div><h3>1. Review the change and affected people</h3>{field('context')}{field('lens')}{field('groups')}
      <p>Include people who perform, receive, approve and support the work, including someone with little influence. Record who benefits and who carries additional effort.</p>
    </div>
    <div><h3>2. Ask AI, then inspect its suggestions</h3>
      <label>People-mapping request<textarea readOnly rows={7} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'People-mapping request copied. Review the suggestions and evidence labels yourself.')}>Copy people-mapping request</button>
      {field('aiOutput')}{field('aiReview')}
      <p>Keep useful questions, revise assumptions and reject invented statements or stereotypes. An AI suggestion remains anticipated until supported by evidence.</p>
    </div>
    <div><h3>3. Record at least five concerns and accountable responses</h3>
      <p>Observed means witnessed behavior; reported means supplied feedback; anticipated means a possibility to investigate. Observed and reported entries require a source. A major concern needs participation, support and a human owner.</p>
      {concerns.map((concern, index) => <fieldset key={index}><legend>Concern {index + 1}</legend>
        <label>Evidence status for concern {index + 1}<select value={concern.evidenceStatus} onChange={e => setConcerns(old => old.map((item, i) => i === index ? { ...item, evidenceStatus: e.target.value as Concern['evidenceStatus'] } : item))}>
          <option value="anticipated">Anticipated — possibility to investigate</option><option value="observed">Observed — witnessed behavior</option><option value="reported">Reported — supplied feedback</option>
        </select></label>
        {(Object.keys(concernLabels) as Array<Exclude<keyof Concern, 'evidenceStatus'>>).map(key => <label key={key}>{concernLabels[key]} — concern {index + 1}<textarea rows={2} required={key !== 'source' || concern.evidenceStatus !== 'anticipated'} value={concern[key]} onChange={e => setConcerns(old => old.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item))} /></label>)}
      </fieldset>)}
      <button type="button" onClick={() => setConcerns(old => [...old, emptyConcern()])}>Add another concern</button>
    </div>
    <div><h3>4. Review another person’s experience and change one decision</h3>
      {(['perspective', 'designBefore', 'designAfter', 'decisionNote', 'openQuestions'] as const).map(field)}
      <p>Explain the before-and-after decision and its reason. Identify facts, listening and leadership approval still needed. Proposed changes remain subject to human review and testing.</p>
    </div>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save people section to My Project Record'}</button> : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 3.1 people section copied.')}>Copy my Lesson 3.1 record</button>
      <details><summary>Read or copy my people section</summary><textarea aria-label="Lesson 3.1 people record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your people section is ready to save for human review.' : 'Complete the people map, five concerns, evidence sources where required and design decision before saving.')}</p>
      <p>Saving preserves your reported evidence. It does not approve deployment or mark the lesson complete. Carry the people section and open questions into Lesson 3.2.</p>
    </div>
  </section>
}
