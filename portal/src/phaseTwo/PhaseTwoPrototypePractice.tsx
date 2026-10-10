import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "workflow": "Existing project charter and workflow map",
  "concept": "Bounded solution concept carried from Lesson 2.4",
  "scope": "One narrow path — allowed actions and excluded actions",
  "inputs": "Normal-case input — fictional or authorized material",
  "criteria": "Acceptance criteria defined before the run",
  "owner": "Human review owner and approval retained",
  "completion": "Completion signal for the reviewed result",
  "baseline": "Comparable baseline artifact and observed starting result",
  "artifact": "First working artifact — reusable request/template text or accessible authorized reference",
  "runContext": "Run context — tool, date and input classification",
  "actualRequest": "Exact request actually used for the first normal run",
  "firstOutput": "Actual first-run output",
  "inspection": "First inspection — criterion, result and supporting evidence",
  "revision": "One material revision and the finding it addresses",
  "revisedArtifact": "Revised working artifact — text or accessible authorized reference",
  "revisedRequest": "Exact request actually used for the revised normal run",
  "revisedOutput": "Actual revised output using the same normal input",
  "comparison": "Before-and-after comparison against the same criteria",
  "demonstration": "Demonstration — steps actually used, reviewed result and human control point",
  "limits": "What the prototype does, does not do and what remains uncertain"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft
const groups: Array<{ heading: string; keys: Array<keyof Draft> }> = [
  { heading: '1. Bound the complete narrow path', keys: ['workflow', 'concept', 'scope', 'inputs', 'criteria', 'owner', 'completion'] },
  { heading: '2. Baseline and use AI', keys: ['baseline', 'artifact', 'runContext', 'actualRequest', 'firstOutput'] },
  { heading: '3. Inspect and lead one material revision', keys: ['inspection', 'revision', 'revisedArtifact', 'revisedRequest', 'revisedOutput', 'comparison'] },
  { heading: '4. Demonstrate and preserve the working sample', keys: ['demonstration', 'limits'] },
]
export function PhaseTwoPrototypePractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
  const [draft, setDraft] = useState<Draft>(blank)
  const [project, setProject] = useState<{ path: PhaseTwoProjectPath; title: string } | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!enrollmentId) return
    let active = true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active || !record) return
      setProject({ path: record.project_path, title: record.project_title })
      const section = record.sections.ai_solution_concept as {
        prototype_lesson_2_5?: { draft?: Partial<Draft> }
        support_pattern_lesson_2_4?: { draft?: { concept?: string; choice?: string; allowed?: string; prohibited?: string; checkpoints?: string; limits?: string } }
      } | undefined
      const prior = section?.prototype_lesson_2_5?.draft
      if (prior) setDraft(Object.fromEntries(Object.keys(fields).map(key => [key, typeof prior[key as keyof Draft] === 'string' ? prior[key as keyof Draft] : ''])) as Draft)
      else {
        const workflow = record.sections.professional_ai_operating_model as { workflow_view_lesson_2_1?: { workflow_view?: unknown } } | undefined
        const support = section?.support_pattern_lesson_2_4?.draft
        setDraft(old => ({ ...old,
          workflow: workflow?.workflow_view_lesson_2_1?.workflow_view ? JSON.stringify(workflow.workflow_view_lesson_2_1.workflow_view, null, 2) : old.workflow,
          concept: support ? [support.concept, support.choice].filter(Boolean).join('\n') : old.concept,
          scope: support ? [support.allowed && 'Allowed: ' + support.allowed, support.prohibited && 'Excluded: ' + support.prohibited].filter(Boolean).join('\n') : old.scope,
          owner: support?.checkpoints || old.owner,
          limits: support?.limits || old.limits,
        }))
      }
    }).catch(() => { if (active) setStatus('Your Project Record could not load. You can still copy your work.') })
    return () => { active = false }
  }, [enrollmentId])
  const context = [
    draft.workflow, 'Bounded concept: ' + draft.concept, 'Scope: ' + draft.scope,
    'Normal input: ' + draft.inputs, 'Acceptance criteria: ' + draft.criteria,
    'Review owner: ' + draft.owner, 'Completion signal: ' + draft.completion,
    'Baseline: ' + draft.baseline, 'Working artifact: ' + draft.artifact,
  ].join('\n')
  const request = approvedAiRequest.replace('[charter and map]', context || '[charter and map]')
  const complete = Object.values(draft).every(text => text.trim().length > 0)
  const evidence = { lesson: '2.5', draft, prepared_request: request,
    actual_run_reported_by_learner: true, working_artifact_and_run_evidence_required: true,
    practice_only_not_permission_to_deploy: true }
  const recordText = JSON.stringify(evidence, null, 2)
  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); setStatus(message) }
    catch { setStatus('Clipboard is unavailable. Select the request or record text below to copy it.') }
  }
  async function save() {
    if (!enrollmentId || !project || !complete || saving) return
    setSaving(true)
    try {
      const result = await savePhaseTwoProjectUpdate({ enrollmentId, path: project.path, title: project.title,
        patch: { ai_solution_concept: { prototype_lesson_2_5: evidence } },
        decisionNote: 'Lesson 2.5 — bounded working artifact, actual normal run, material revision and demonstration' })
      setStatus('Saved to your continuing Project Record. Version ' + result.saved_version + '.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-prototype-heading">
    <header><p className="eyebrow">Continue Your Project · BUILD Evidence Cycle</p>
      <h2 id="p2-prototype-heading">Build and demonstrate your bounded working sample</h2>
      <p>Continue the charter, map and support concept from your existing project. Use your own AI assistant with fictional or authorized material. Keep production accounts, customer actions and consequential transactions outside an unapproved experiment.</p>
    </header>
    {groups.map((group, i) => <div key={group.heading}>
      <h3>{group.heading}</h3>
      {i === 0 && <p>Define input, criteria, review owner and completion signal before running the normal case. Carry earlier boundaries forward and adjust them only within your authorized scope.</p>}
      {i === 1 && <p>Preserve a comparable baseline. A working artifact can be reusable prompt and template text or an accessible authorized reference. Copy the prepared request to your chosen AI assistant, then record the exact request actually used and its actual output. Label fictional inputs. Do not substitute teaching illustrations or predicted results for your own run.</p>}
      {i === 2 && <p>Inspect each criterion as met, not met or uncertain with evidence. Lead one material change, preserve the revised artifact and exact request, and run the same normal input again. Compare actual outputs using the same criteria; retain unresolved findings honestly.</p>}
      {i === 3 && <p>Demonstrate the steps actually used from artifact and input to the reviewed result. Show the completion signal and human approval point. A description alone does not satisfy completion. Explain the sample's limits and carry the evidence into Lesson 2.6.</p>}
      {group.keys.map(key => <label key={key}>{fields[key]}<textarea rows={['workflow', 'artifact', 'revisedArtifact', 'firstOutput', 'revisedOutput', 'demonstration'].includes(key) ? 5 : 3} value={draft[key]} onChange={e => setDraft(old => ({ ...old, [key]: e.target.value }))} /></label>)}
      {i === 1 && <><label>Prepared prototype request<textarea readOnly rows={8} value={request} /></label>
        <button type="button" onClick={() => void copy(request, 'Prototype request copied. Read it and use it with your chosen AI assistant.')}>Copy prototype request</button></>}
    </div>)}
    <p>Check usability, factual support and ownership before saving. Saving preserves your reported evidence for review; human inspection determines whether the prototype meets its criteria. One normal case does not grant deployment approval.</p>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save prototype evidence to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 2.5 working artifact and evidence copied.')}>Copy my Lesson 2.5 record</button>
      <details><summary>Read or copy my prototype evidence</summary><textarea aria-label="Lesson 2.5 prototype record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your working artifact and reported run evidence are ready to save for review.' : 'Preserve the baseline, working artifact, actual run, revision and demonstration before saving.')}</p>
    </div>
  </section>
}
